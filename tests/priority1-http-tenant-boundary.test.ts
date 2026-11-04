import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';

const connection=process.env.TEST_DATABASE_URL;
if(!connection||!new URL(connection).pathname.endsWith('_test')||
 process.env.DATABASE_URL!==connection)
 throw Error('HTTP tenant test must use a disposable PostgreSQL database named *_test');

const {prisma}=await import('../modules/storage/client');
const {initialState}=await import('../modules/commerce/seed');
const {applyAction}=await import('../modules/commerce/service');
const {newSession}=await import('../modules/auth/crypto');

const host='http://127.0.0.1:3141';
const origin='https://p1-tunicommerce-ci.example.test';
const mark=randomUUID().slice(0,8);
let server:ReturnType<typeof spawn>|undefined;
async function actor(role:string){
 const user=await prisma.user.create({data:{email:role.toLowerCase()+'-'+randomUUID()+'@example.test',
  name:'Test '+role,passwordHash:'test-only',role}});
 const session=newSession();
 await prisma.session.create({data:{userId:user.id,tokenHash:session.tokenHash,expiresAt:session.expiresAt}});
 return {id:user.id,cookie:'__Host-tunicommerce='+session.token};
}
async function shop(ownerId:string,slug:string){
 const org=await prisma.organization.create({data:{ownerId,name:'Isolated '+slug}});
 const row=await prisma.shop.create({data:{organizationId:org.id,name:'Shop '+slug,slug,status:'DRAFT'}});
 await prisma.membership.create({data:{shopId:row.id,userId:ownerId,role:'OWNER',active:true}});
 const state=initialState(false);
 state.products=[{id:'product-'+slug,sku:'SKU-'+slug,name:'Produit',category:'Mode',
  variant:'',price:20000,cost:3000,stock:5,threshold:1,color:'#ffffff',active:true}];
 let next=applyAction(state,'createOrder',{name:'Acheteur privé '+slug,phone:'22123456',city:'Gabès',
  address:'Adresse privée '+slug,source:'Boutique',items:[{productId:'product-'+slug,quantity:1}]});
 if(slug.includes('alpha')){
  next=applyAction(next,'createOrder',{name:'Autre acheteur privé',phone:'55123456',city:'Gabès',
   address:'Autre adresse privée',source:'Boutique',items:[{productId:'product-'+slug,quantity:1}]});
 }
 await prisma.shopCommerce.create({data:{shopId:row.id,data:next as unknown as Prisma.InputJsonValue}});
 return {id:row.id,orders:next.orders};
}
function get(path:string,cookie?:string){
 return fetch(host+path,{headers:cookie?{cookie}:undefined,redirect:'manual'});
}
function post(path:string,body:unknown,cookie?:string,requestOrigin=origin){
 return fetch(host+path,{method:'POST',redirect:'manual',headers:{
  origin:requestOrigin,'content-type':'application/json',...(cookie?{cookie}:{})
 },body:JSON.stringify(body)});
}

test('HTTP integration: two tenants, role revocation, CSRF and staff filtering',async t=>{
 try{
  const ownerA=await actor('MERCHANT'),ownerB=await actor('MERCHANT'),globalAdmin=await actor('ADMIN');
  const agentA=await actor('MERCHANT'),agentB=await actor('MERCHANT'),viewer=await actor('MERCHANT');
  for(const id of [ownerA.id,ownerB.id])
   await prisma.workspace.create({data:{ownerId:id,data:initialState(false) as unknown as Prisma.InputJsonValue}});
  const a=await shop(ownerA.id,'p1-'+mark+'-alpha');
  const b=await shop(ownerB.id,'p1-'+mark+'-bravo');
  for(const user of [agentA,agentB,viewer]){
   await prisma.membership.create({data:{shopId:a.id,userId:user.id,
    role:user===viewer?'VIEWER':'CALL_CENTER',active:true}});
  }
  // First order assigned exclusively to agent A; second remains in the common queue.
  const first=a.orders[1];
  const stored=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.id}});
  const current=(await import('../modules/commerce/normalize')).normalizeState(stored.data as never);
  const assigned=applyAction(current,'assignCallAgent',{id:first.id,agentId:agentA.id});
  await prisma.shopCommerce.update({where:{shopId:a.id},
   data:{data:assigned as unknown as Prisma.InputJsonValue}});

  server=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3141',APP_URL:origin,DATABASE_URL:connection},
   stdio:'ignore'
  });
  let ready=false;
  for(let i=0;i<120;i++){
   if(server.exitCode!==null)throw Error('Production server exited during test');
   try{const response=await get('/api/health');if(response.ok){ready=true;break;}}catch{}
   await sleep(200);
  }
  assert.equal(ready,true,'Next.js production web server should be ready');

  await t.test('anonymous and global ADMIN without membership cannot read merchant orders',async()=>{
   const endpoint='/api/v1/shops/'+a.id+'/orders';
   assert.equal((await get(endpoint)).status,401);
   assert.equal((await get(endpoint,ownerB.cookie)).status,404);
   assert.equal((await get(endpoint,globalAdmin.cookie)).status,404);
   assert.equal((await get(endpoint,agentA.cookie)).status,403);
   assert.equal((await get(endpoint,ownerA.cookie)).status,200);
   assert.equal((await get('/api/v1/shops/'+b.id+'/orders',ownerA.cookie)).status,404);
  });

  await t.test('staff sees only unassigned and own orders; viewer receives no buyer PII',async()=>{
   const endpoint='/api/v1/shops/'+a.id+'/team-view?section=orders';
   const own=await (await get(endpoint,agentA.cookie)).json() as {orders:{id:string}[]};
   const peer=await (await get(endpoint,agentB.cookie)).json() as {orders:{id:string}[]};
   assert.equal(own.orders.length,2);
   assert.equal(peer.orders.length,1);
   assert.equal(peer.orders.some(order=>order.id===first.id),false);
   const response=await get(endpoint,viewer.cookie);
   assert.equal(response.status,200);
   const view=JSON.stringify(await response.json());
   for(const privateValue of ['22123456','55123456','Acheteur privé','Adresse privée','Autre adresse privée'])
    assert.equal(view.includes(privateValue),false);
   assert.equal((await get(endpoint,ownerB.cookie)).status,404);
  });

  await t.test('warehouse mutation rejects CSRF, cross-owner, and employees before state updates',async()=>{
   const endpoint='/api/v1/shops/'+a.id+'/warehouses';
   const body={action:'initializeWarehouses',requestId:randomUUID(),payload:{}};
   assert.equal((await post(endpoint,body,ownerA.cookie,'https://evil.example.test')).status,403);
   assert.equal((await post(endpoint,body,ownerB.cookie)).status,404);
   assert.equal((await post(endpoint,body,agentA.cookie)).status,403);
   const result=await post(endpoint,body,ownerA.cookie);
   assert.equal(result.status,200);
   assert.equal((await result.json() as {initialized:boolean}).initialized,true);
   const replay=await post(endpoint,body,ownerA.cookie);
   assert.equal(replay.status,200);
   assert.equal((await replay.json() as {alreadyApplied:boolean}).alreadyApplied,true);
   assert.equal((await get('/api/v1/shops/'+b.id+'/warehouses',ownerA.cookie)).status,404);
   assert.equal((await get(endpoint,globalAdmin.cookie)).status,404);
  });

  await t.test('P1/P3 dispatch CSV pagination requires owner session and never exports another tenant',async()=>{
   const commerceRow=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.id}});
   const {normalizeState}=await import('../modules/commerce/normalize');
   let state=normalizeState(commerceRow.data as never);
   const one=state.orders[0].id;
   for(const status of ['CONFIRMED','PREPARING','READY'] as const)state=applyAction(state,'transition',{id:one,status});
   await prisma.shopCommerce.update({where:{shopId:a.id},data:{data:state as unknown as Prisma.InputJsonValue}});
   const path='/api/v1/shops/'+a.id+'/dispatch-manifest?status=READY&page=1&format=json';
   assert.equal((await get(path)).status,401);
   assert.equal((await get(path,ownerB.cookie)).status,404);
   assert.equal((await get(path,globalAdmin.cookie)).status,404);
   assert.equal((await get(path,agentA.cookie)).status,403);
   const response=await get(path,ownerA.cookie);
   assert.equal(response.status,200);
   const summary=await response.json() as {total:number;readyCount:number;shippedCount:number};
   assert.equal(summary.total,1);
   assert.equal(summary.readyCount,1);
   assert.equal(JSON.stringify(summary).includes('22123456'),false);
   const downloaded=await get('/api/v1/shops/'+a.id+'/dispatch-manifest?status=READY&page=1&format=csv',ownerA.cookie);
   assert.equal(downloaded.status,200);
   assert.equal(downloaded.headers.get('x-export-total-rows'),'1');
   assert.ok(downloaded.headers.get('cache-control')?.includes('no-store'));
   const csv=await downloaded.text();
   assert.ok(csv.includes('Autre adresse privée'));
   assert.equal(csv.includes('Adresse privée p1-'+mark+'-bravo'),false);
   assert.equal((await get('/api/v1/shops/'+a.id+'/dispatch-manifest?page=2',ownerA.cookie)).status,400);
   assert.equal((await get('/api/v1/shops/'+a.id+'/dispatch-manifest?format=html',ownerA.cookie)).status,400);
  });

  await t.test('revoked employee loses access despite existing signed session',async()=>{
   await prisma.membership.update({where:{shopId_userId:{shopId:a.id,userId:viewer.id}},
    data:{active:false}});
   assert.equal((await get('/api/v1/shops/'+a.id+'/team-view?section=orders',viewer.cookie)).status,404);
  });
 }finally{
  server?.kill('SIGTERM');
  await prisma.$disconnect();
 }
});
