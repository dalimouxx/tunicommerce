import test from 'node:test';
import {stopTestServer} from './server-process';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('_test'))throw Error('Dedicated *_test database required');
process.env.DATABASE_URL=url;

const {prisma}=await import('../modules/storage/client');
const base='http://127.0.0.1:3149';
const origin='https://test.local';
const setupToken=randomBytes(32).toString('hex');
const password='TuniCommerce-Register-2026!';
let child:ChildProcess|undefined;
const post=(path:string,body:unknown,cookie='',requestOrigin=origin)=>fetch(base+path,{
 method:'POST',headers:{origin:requestOrigin,'content-type':'application/json',cookie},
 body:JSON.stringify(body),redirect:'manual'
});
const get=(path:string,cookie='')=>fetch(base+path,{headers:{cookie},redirect:'manual'});
async function reset(){
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
}
const details={action:'details',name:'Mode Gabès',phone:'+216 22 123 456',address:'Beb Bhar, Gabès',
 description:'Vêtements et accessoires',shipping:7000};
const registration=(email:string,slug:string)=>({
 name:'Test Marchand',email,password,shopName:'Mode Gabès',slug
});

test('Self-service merchant creates, configures, publishes and sells without changing legacy flows',async t=>{
 try{
  await reset();
  child=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3149',DATABASE_URL:url,APP_URL:origin,SETUP_TOKEN:setupToken},
   stdio:'ignore'
  });
  let ready=false;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error('Server exited before tests');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true);

  await t.test('Public signup is visible, origin-protected and validates input',async()=>{
   assert.equal((await get('/inscription')).status,200);
   assert.equal((await post('/api/auth/register',registration('first@example.test','mode-gabes'),'','https://evil.test')).status,403);
   assert.equal((await post('/api/auth/register',{...registration('first@example.test','mode-gabes'),role:'ADMIN'})).status,400);
   assert.equal((await post('/api/auth/register',{...registration('first@example.test','bad slug'),password:'weak'})).status,400);
   assert.equal((await get('/api/v1/onboarding')).status,401);
   assert.equal((await post('/api/v1/onboarding',{action:'publish'})).status,401);
   assert.equal((await prisma.user.count()),0);
  });

  const first=await post('/api/auth/register',registration('first@example.test','mode-gabes'));
  assert.equal(first.status,201);
  const cookie=first.headers.get('set-cookie')!.split(';')[0];
  assert.ok(cookie.includes('__Host-tunicommerce='));
  assert.equal((await first.json()).next,'/demarrage');

  await t.test('New user gets a blank Workspace linked to Organization, Shop and OWNER membership atomically',async()=>{
   const user=await prisma.user.findUniqueOrThrow({where:{email:'first@example.test'}});
   assert.equal(user.role,'MERCHANT');
   const workspace=await prisma.workspace.findUniqueOrThrow({where:{ownerId:user.id}});
   assert.equal(workspace.slug,'mode-gabes');
   assert.equal(workspace.published,false);
   assert.equal(workspace.plan,'STARTER');
   assert.equal(workspace.subscriptionStatus,'TRIAL');
   const shop=await prisma.shop.findUniqueOrThrow({
    where:{legacyWorkspaceId:workspace.id},include:{memberships:true,organization:true}
   });
   assert.equal(shop.slug,'mode-gabes');
   assert.equal(shop.status,'DRAFT');
   assert.equal(shop.memberships.length,1);
   assert.equal(shop.memberships[0].userId,user.id);
   assert.equal(shop.memberships[0].role,'OWNER');
   assert.equal(shop.organization.ownerId,user.id);
   const blank=await get('/api/commerce',cookie);
   assert.equal(blank.status,200);
   const state=(await blank.json()).state;
   assert.deepEqual(state.orders,[]);
   assert.deepEqual(state.products,[]);
   assert.equal(state.demo,false);
   assert.equal((await get('/boutiques/mode-gabes')).status,404);
   assert.equal((await get('/demarrage',cookie)).status,200);
   assert.equal((await get('/',cookie)).status,307);
   assert.equal((await get('/admin',cookie)).status,307);
   assert.equal((await post('/api/auth/register',registration('first@example.test','new-gabes'))).status,409);
   assert.equal((await post('/api/auth/register',registration('second@example.test','mode-gabes'))).status,409);
   assert.equal(await prisma.user.count(),1);
   assert.equal(await prisma.workspace.count(),1);
  });

  await t.test('Configuration is owner-only; publishing requires usable product and contact info',async()=>{
   const missing=await post('/api/v1/onboarding',{action:'publish'},cookie);
   assert.equal(missing.status,409);
   const owner=await get('/api/v1/onboarding',cookie);
   assert.equal(owner.status,200);
   const info=(await owner.json()).onboarding;
   assert.equal(info.ready,false);
   assert.equal(info.availableCount,0);
   assert.equal(info.published,false);
   assert.equal((await post('/api/v1/onboarding',{...details,ownerId:'forged'},cookie)).status,400);
   assert.equal((await post('/api/v1/onboarding',details,cookie,'https://evil.test')).status,403);
   assert.equal((await post('/api/v1/onboarding',details,cookie)).status,200);
   assert.equal((await post('/api/v1/onboarding',{action:'publish'},cookie)).status,409);
   assert.equal((await post('/api/v1/onboarding',{action:'slug',slug:'mode-gabes-shop'},cookie)).status,200);
   assert.equal((await get('/boutiques/mode-gabes')).status,404);
   assert.equal((await get('/boutiques/mode-gabes-shop')).status,404);
   const product={name:'Foulard coton',sku:'GAB-001',category:'Accessoires',
    variant:'Standard',price:39900,cost:19000,stock:12,threshold:2,color:'#d8bbab'};
   const create=await post('/api/commerce',{action:'product',requestId:crypto.randomUUID(),payload:product},cookie);
   assert.equal(create.status,200);
   const ready=(await (await get('/api/v1/onboarding',cookie)).json()).onboarding;
   assert.equal(ready.ready,true);
   assert.equal(ready.availableCount,1);
   assert.equal(ready.shop.name,'Mode Gabès');
   assert.equal(ready.slug,'mode-gabes-shop');
   assert.equal((await post('/api/v1/onboarding',{action:'publish'},cookie)).status,200);
   assert.equal((await (await get('/api/v1/onboarding',cookie)).json()).onboarding.published,true);
   const shop=await get('/boutiques/mode-gabes-shop');
   assert.equal(shop.status,200);
   assert.ok((await shop.text()).includes('Foulard coton'));
  });

  await t.test('Published shop accepts COD checkout; sale appears only in owner dashboard',async()=>{
   const state=(await (await get('/api/commerce',cookie)).json()).state;
   const product=state.products.find((p:{sku:string})=>p.sku==='GAB-001');
   assert.ok(product);
   const requestId=crypto.randomUUID();
   const order={requestId,customer:{name:'Cliente Test',phone:'22123456',city:'Tunis',address:'Rue des Oliviers'},items:[{productId:product.id,quantity:2}]};
   const r=await post('/api/boutiques/mode-gabes-shop/checkout',order);
   assert.equal(r.status,201);
   const receipt=await r.json();
   assert.ok(receipt.reference);
   assert.ok(receipt.trackingUrl?.startsWith('/suivi/'));
   const tracking=await get(receipt.trackingUrl);
   assert.equal(tracking.status,200);
   const after=(await (await get('/api/commerce',cookie)).json()).state;
   assert.equal(after.orders.length,1);
   assert.equal(after.orders[0].status,'TO_CONFIRM');
   assert.equal(after.products.find((p:{id:string})=>p.id===product.id).stock,10);
   assert.equal((await post('/api/boutiques/mode-gabes-shop/checkout',order)).status,201);
   assert.equal((await (await get('/api/commerce',cookie)).json()).state.orders.length,1);
   assert.equal((await post('/api/v1/onboarding',{action:'unpublish'},cookie)).status,200);
   assert.equal((await get('/boutiques/mode-gabes-shop')).status,404);
   assert.equal((await get('/api/commerce',cookie)).status,200);
  });

  await t.test('Second merchant cannot see or alter first merchant shop',async()=>{
   const second=await post('/api/auth/register',registration('second@example.test','mode-sfax'));
   assert.equal(second.status,201);
   const secondCookie=second.headers.get('set-cookie')!.split(';')[0];
   assert.equal((await (await get('/api/v1/onboarding',secondCookie)).json()).onboarding.productCount,0);
   assert.equal((await (await get('/api/commerce',secondCookie)).json()).state.orders.length,0);
   const u=await prisma.user.findUniqueOrThrow({where:{email:'second@example.test'}});
   const workspace=await prisma.workspace.findUniqueOrThrow({where:{ownerId:u.id}});
   assert.equal(workspace.slug,'mode-sfax');
   const change=await post('/api/v1/onboarding',{action:'slug',slug:'mode-gabes-shop'},secondCookie);
   assert.equal(change.status,409);
   assert.equal((await post('/api/v1/onboarding',{action:'publish'},secondCookie)).status,409);
   const firstWorkspace=await prisma.workspace.findUniqueOrThrow({where:{slug:'mode-gabes-shop'}});
   assert.notEqual(firstWorkspace.ownerId,u.id);
   assert.equal(await prisma.workspace.count(),2);
   assert.equal(await prisma.shop.count(),2);
   assert.equal((await get('/api/v1/shops',secondCookie)).status,200);
   const shops=(await (await get('/api/v1/shops',secondCookie)).json()).shops;
   assert.equal(shops.length,1);
   assert.equal(shops[0].slug,'mode-sfax');
  });

 }finally{
  stopTestServer(child);
  await prisma.$disconnect();
 }
});
