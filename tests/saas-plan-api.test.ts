import test from 'node:test';
import {stopTestServer} from './server-process';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test'))
 throw Error('SaaS tests must use an isolated *_test PostgreSQL database');
process.env.DATABASE_URL=database;
const {prisma}=await import('../modules/storage/client');
const {assertCommerceQuotas}=await import('../modules/subscriptions/quotas');
const {initialState}=await import('../modules/commerce/seed');

const base='http://127.0.0.1:3177';
const origin='https://test.local';
const password='SaaS-Pricing-QA-2026!';
const setupToken=randomBytes(32).toString('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');
let child:ChildProcess|undefined;

function get(path:string,cookie=''){return fetch(base+path,{redirect:'manual',headers:{cookie}});}
function post(path:string,data:unknown,cookie='',requestOrigin=origin){
 return fetch(base+path,{method:'POST',redirect:'manual',
  headers:{origin:requestOrigin,cookie,'content-type':'application/json'},body:JSON.stringify(data)});
}
function upload(cookie:string){
 return fetch(base+'/api/v1/product-media',{
  method:'PUT',headers:{origin,cookie,'content-type':'image/png'},
  body:new Blob([new Uint8Array(png)]),redirect:'manual'
 });
}
const future=new Date(Date.now()+45*86400_000).toISOString();
const modules={
 callCenter:true,marketing:false,analytics:true,
 aiCopilot:false,customDomain:false,multiShop:false
};
const newPlan={
 code:'PILOT_PLUS',name:'Pilote Plus',description:'Formule de démonstration',
 priceMillimes:49900,durationDays:30,maxProducts:1,maxOrdersPerMonth:1,
 maxPhotos:1,maxShops:1,maxMembers:2,modules,enabled:true
};

async function clean(){
 await prisma.subscriptionPlanAudit.deleteMany();
 await prisma.workspacePlanOverride.deleteMany();
 await prisma.productMedia.deleteMany();
 await prisma.shopMedia.deleteMany();
 await prisma.shopInvitation.deleteMany();
 await prisma.membership.deleteMany();
 await prisma.shop.deleteMany();
 await prisma.organization.deleteMany();
 await prisma.platformAudit.deleteMany();
 await prisma.publicReceipt.deleteMany();
 await prisma.session.deleteMany();
 await prisma.workspace.deleteMany();
 await prisma.user.deleteMany();
 await prisma.setupLock.deleteMany();
 await prisma.authThrottle.deleteMany();
 await prisma.subscriptionPlan.deleteMany({where:{code:'PILOT_PLUS'}});
}
function product(sku:string){return{
 name:'Produit '+sku,sku,category:'Accessoires',variant:'Noir',
 price:60000,cost:25000,stock:6,threshold:1,color:'#AABBCC'
};}

test('SaaS configurable catalog, quota exceptions and COD safety',async t=>{
 try{
  await clean();
  child=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3177',DATABASE_URL:database,APP_URL:origin,SETUP_TOKEN:setupToken},
   stdio:'ignore'
  });
  let ready=false;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error('Next production server exited');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true);

  await t.test('Admin plan API is private, and default plans keep legacy merchants unlimited',async()=>{
   assert.equal((await get('/admin/plans')).status,307);
   assert.equal((await get('/api/admin/plans')).status,401);
   assert.equal((await post('/api/admin/plans',newPlan)).status,401);
   const defaults=await prisma.subscriptionPlan.findMany();
   assert.ok(defaults.some(p=>p.code==='FREE'));
   assert.ok(defaults.some(p=>p.code==='STARTER'&&p.maxProducts===null));
   const seed=initialState(false);
   const next=structuredClone(seed);
   next.products.push(...Array.from({length:500},(_,i)=>({
    id:randomUUID(),name:'Item',sku:'ITEM-'+i,category:'Mode',variant:'',
    price:1000,cost:0,stock:1,threshold:0,color:'#aabbcc',active:true
   })));
   assert.doesNotThrow(()=>assertCommerceQuotas(seed,next,{
    maxProducts:null,maxOrdersPerMonth:null,maxPhotos:30
   }));
  });

  const setup=await post('/api/auth/setup',{name:'Plateforme SaaS',
   email:'admin@example.test',password,token:setupToken});
  assert.equal(setup.status,201);
  const login=await post('/api/auth/admin/login',{email:'admin@example.test',password});
  assert.equal(login.status,200);
  const adminCookie=login.headers.get('set-cookie')!.split(';')[0];

  await t.test('Admin creates custom TND plan with quotas and recorded audit',async()=>{
   assert.equal((await post('/api/admin/plans',newPlan,adminCookie,'https://evil.test')).status,403);
   const malformed=await post('/api/admin/plans',{...newPlan,maxProducts:-2},adminCookie);
   assert.equal(malformed.status,400);
   const created=await post('/api/admin/plans',newPlan,adminCookie);
   assert.equal(created.status,200);
   const plan=await prisma.subscriptionPlan.findUniqueOrThrow({where:{code:'PILOT_PLUS'}});
   assert.equal(plan.priceMillimes,49900);
   assert.equal(plan.maxProducts,1);
   assert.equal(plan.maxOrdersPerMonth,1);
   assert.equal(plan.maxPhotos,1);
   assert.equal(plan.durationDays,30);
   assert.equal(await prisma.subscriptionPlanAudit.count({where:{planCode:'PILOT_PLUS'}}),1);
   assert.equal((await get('/admin/plans',adminCookie)).status,200);
   const body=await (await get('/admin/plans',adminCookie)).text();
   assert.ok(body.includes('Pilote Plus'));
   assert.ok(body.includes('Gestion des offres et quotas'));
   const api=(await (await get('/api/admin/plans',adminCookie)).json()).plans;
   assert.ok(api.some((p:{code:string})=>p.code==='PILOT_PLUS'));
  });

  let workspaceId='';
  let merchantCookie='';
  await t.test('Plan can be assigned to merchant and cannot be disabled while assigned',async()=>{
   const created=await post('/api/admin/shops',{
    action:'create',name:'Marchand SaaS',email:'merchant@example.test',
    password,shopName:'Boutique Pilote',slug:'boutique-pilote',
    published:false,plan:'PILOT_PLUS',subscriptionStatus:'ACTIVE',
    subscriptionEndsAt:future
   },adminCookie);
   assert.equal(created.status,200);
   workspaceId=(await created.json()).workspaceId;
   const login=await post('/api/auth/login',{email:'merchant@example.test',password});
   assert.equal(login.status,200);
   merchantCookie=login.headers.get('set-cookie')!.split(';')[0];
   assert.equal((await get('/api/admin/plans',merchantCookie)).status,401);
   assert.equal((await post('/api/admin/plans',newPlan,merchantCookie)).status,401);
   assert.equal((await post('/api/admin/plans',{...newPlan,enabled:false},adminCookie)).status,409);
   assert.equal((await post('/api/admin/shops',{
    action:'update',id:workspaceId,slug:'boutique-pilote',published:false,
    plan:'UNKNOWN',subscriptionStatus:'ACTIVE',subscriptionEndsAt:future
   },adminCookie)).status,409);
  });

  await t.test('Product creation respects plan, edits remain possible, no old products removed',async()=>{
   let a=await post('/api/commerce',{
    action:'product',requestId:randomUUID(),payload:product('A')
   },merchantCookie);
   assert.equal(a.status,200);
   let state=(await a.json()).state;
   assert.equal(state.products.length,1);
   assert.equal((await post('/api/commerce',{
    action:'product',requestId:randomUUID(),payload:product('B')
   },merchantCookie)).status,409);
   a=await post('/api/commerce',{
    action:'product',requestId:randomUUID(),payload:{
     ...product('A'),id:state.products[0].id,name:'Produit A modifié'
    }
   },merchantCookie);
   assert.equal(a.status,200);
   assert.equal((await a.json()).state.products.length,1);
  });

  await t.test('Photo quota is enforced in transaction and gallery exposes correct limit',async()=>{
   assert.equal((await upload(merchantCookie)).status,201);
   assert.equal((await upload(merchantCookie)).status,409);
   const list=(await (await get('/api/v1/product-media',merchantCookie)).json());
   assert.equal(list.photos.length,1);
   assert.equal(list.limit,1);
  });

  await t.test('COD checkout is counted monthly and blocks the second order atomically',async()=>{
   const enabled=await post('/api/admin/shops',{
    action:'update',id:workspaceId,slug:'boutique-pilote',published:true,
    plan:'PILOT_PLUS',subscriptionStatus:'ACTIVE',subscriptionEndsAt:future
   },adminCookie);
   assert.equal(enabled.status,200);
   const state=(await (await get('/api/commerce',merchantCookie)).json()).state;
   const buyer=(requestId:string)=>({
    requestId,customer:{name:'Client de Gabès',phone:'22123456',
     city:'Gabès',address:'Rue 12, Centre'},
    items:[{productId:state.products[0].id,quantity:1}]
   });
   assert.equal((await post('/api/boutiques/boutique-pilote/checkout',buyer(randomUUID()))).status,201);
   const blocked=await post('/api/boutiques/boutique-pilote/checkout',buyer(randomUUID()));
   assert.equal(blocked.status,409);
   const after=(await (await get('/api/commerce',merchantCookie)).json()).state;
   assert.equal(after.orders.length,1);
   assert.equal(after.products[0].stock,5);
  });

  await t.test('Per-boutique exceptions are private, audited and work without resetting history',async()=>{
   const input={
    workspaceId,maxProducts:2,maxOrdersPerMonth:2,maxPhotos:2,
    note:'Boutique pilote sous autorisation'
   };
   assert.equal((await post('/api/admin/plan-overrides',input,merchantCookie)).status,401);
   assert.equal((await post('/api/admin/plan-overrides',input,adminCookie,'https://evil.test')).status,403);
   const save=await post('/api/admin/plan-overrides',input,adminCookie);
   assert.equal(save.status,200);
   assert.equal((await (await get('/api/v1/product-media',merchantCookie)).json()).limit,2);
   assert.equal((await upload(merchantCookie)).status,201);
   assert.equal((await post('/api/commerce',{
    action:'product',requestId:randomUUID(),payload:product('B')
   },merchantCookie)).status,200);
   assert.equal((await post('/api/commerce',{
    action:'product',requestId:randomUUID(),payload:product('C')
   },merchantCookie)).status,409);
   const state=(await (await get('/api/commerce',merchantCookie)).json()).state;
   const buyer={
    requestId:randomUUID(),customer:{name:'Autre client',phone:'22123457',
     city:'Gabès',address:'Rue 13, Centre'},
    items:[{productId:state.products[0].id,quantity:1}]
   };
   assert.equal((await post('/api/boutiques/boutique-pilote/checkout',buyer)).status,201);
   assert.equal((await post('/api/boutiques/boutique-pilote/checkout',{
    ...buyer,requestId:randomUUID()
   })).status,409);
   const after=(await (await get('/api/commerce',merchantCookie)).json()).state;
   assert.equal(after.orders.length,2);
   assert.equal(await prisma.platformAudit.count({
    where:{workspaceId,detail:{contains:'override'}}
   }),1);
   assert.equal((await get('/admin/boutiques/'+workspaceId,adminCookie)).status,200);
  });
 }finally{
  stopTestServer(child);
  await prisma.$disconnect();
 }
});
