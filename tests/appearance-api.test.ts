import test from 'node:test';
import {stopTestServer} from './server-process';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test'))throw Error('Dedicated *_test PostgreSQL database required');
process.env.DATABASE_URL=database;
const {prisma}=await import('../modules/storage/client');
const base='http://127.0.0.1:3152';
const origin='https://test.local';
const password='Themed-Shop-Test-password-2026';
const setupToken=randomBytes(32).toString('hex');
let child:ChildProcess|undefined;

const post=(path:string,body:unknown,cookie='',from=origin)=>fetch(base+path,{
 method:'POST',headers:{origin:from,cookie,'content-type':'application/json'},
 body:JSON.stringify(body),redirect:'manual'
});
const get=(path:string,cookie='')=>fetch(base+path,{headers:{cookie},redirect:'manual'});

async function resetDatabase(){
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
async function register(email:string,slug:string){
 const response=await post('/api/auth/register',{
  name:'Test merchant',email,password,shopName:'Soleil de Gabès',slug
 });
 assert.equal(response.status,201);
 return response.headers.get('set-cookie')!.split(';')[0];
}
const design={
 theme:'prestige',accent:'#244A77',
 eyebrow:'NOUVELLE COLLECTION',tagline:'Livraison en Tunisie · Paiement à la livraison',
 description:'Une sélection premium de créations tunisiennes.',
 logoUrl:'https://images.example.test/logo.png',
 bannerUrl:'https://images.example.test/banner.webp'
};

test('Theme editor persists per merchant and preserves published COD storefront',async t=>{
 try{
  await resetDatabase();
  child=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3152',DATABASE_URL:database,APP_URL:origin,SETUP_TOKEN:setupToken},
   stdio:'ignore'
  });
  let ready=false;
  for(let attempt=0;attempt<120;attempt++){
   if(child.exitCode!==null)throw Error('Server exited before tests');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true,'Server must be running before HTTP requests');

  await t.test('Editor protected from anonymous visitors, CSRF, and global admins',async()=>{
   assert.equal((await get('/personnalisation')).status,307);
   assert.equal((await get('/api/v1/appearance')).status,401);
   assert.equal((await post('/api/v1/appearance',design)).status,401);
   assert.equal((await post('/api/v1/appearance',design,'','https://evil.test')).status,403);
   const admin=await post('/api/auth/setup',{
    email:'platform@example.test',name:'Admin',password,token:setupToken
   });
   assert.equal(admin.status,201);
   const login=await post('/api/auth/login',{email:'platform@example.test',password});
   assert.equal(login.status,200);
   const adminCookie=login.headers.get('set-cookie')!.split(';')[0];
   assert.equal((await get('/personnalisation',adminCookie)).status,307);
   assert.equal((await get('/api/v1/appearance',adminCookie)).status,403);
   assert.equal((await post('/api/v1/appearance',design,adminCookie)).status,403);
  });

  const cookie=await register('merchant@example.test','soleil-de-gabes');
  await t.test('Legacy merchant default remains classic until explicit customization',async()=>{
   const response=await get('/api/v1/appearance',cookie);
   assert.equal(response.status,200);
   const store=(await response.json()).store;
   assert.equal(store.appearance.theme,'classic');
   assert.equal(store.appearance.accent,'#21815F');
   assert.equal(store.shopName,'Soleil de Gabès');
   assert.equal(store.sampleProducts.length,0);
   assert.equal((await get('/personnalisation',cookie)).status,200);
   assert.equal((await get('/boutiques/soleil-de-gabes')).status,404);
  });

  await t.test('Invalid themes, CSS injection, malicious URLs, cross-origin mutations are rejected',async()=>{
   assert.equal((await post('/api/v1/appearance',{...design,theme:'injected'},cookie)).status,400);
   assert.equal((await post('/api/v1/appearance',{...design,accent:'red;position:absolute'},cookie)).status,400);
   assert.equal((await post('/api/v1/appearance',{...design,logoUrl:'http://unsafe.test/logo.png'},cookie)).status,400);
   assert.equal((await post('/api/v1/appearance',{...design,workspaceId:'forged'},cookie)).status,400);
   assert.equal((await post('/api/v1/appearance',design,cookie,'https://other.test')).status,403);
   assert.equal((await (await get('/api/v1/appearance',cookie)).json()).store.appearance.theme,'classic');
  });

  let initialState:unknown;
  await t.test('Saving merchant design does not rewrite any products, customers, orders or stock',async()=>{
   const product={name:'Sac en cuir',sku:'GAB-SAC-1',category:'Mode',variant:'Naturel',price:99000,cost:41000,stock:8,threshold:2,color:'#E6CCAA'};
   const added=await post('/api/commerce',{
    action:'product',requestId:crypto.randomUUID(),payload:product
   },cookie);
   assert.equal(added.status,200);
   initialState=(await (await get('/api/commerce',cookie)).json()).state;
   const result=await post('/api/v1/appearance',design,cookie);
   assert.equal(result.status,200);
   const response=await get('/api/v1/appearance',cookie);
   const updated=(await response.json()).store;
   assert.equal(updated.appearance.theme,'prestige');
   assert.equal(updated.appearance.accent,'#244A77');
   assert.equal(updated.logoUrl,design.logoUrl);
   assert.equal(updated.bannerUrl,design.bannerUrl);
   assert.equal(updated.description,design.description);
   assert.equal(updated.sampleProducts[0].name,'Sac en cuir');
   const changed=(await (await get('/api/commerce',cookie)).json()).state;
   assert.deepEqual(changed.products,(initialState as {products:unknown}).products);
   assert.deepEqual(changed.orders,(initialState as {orders:unknown}).orders);
   assert.deepEqual(changed.customers,(initialState as {customers:unknown}).customers);
   assert.deepEqual(changed.movements,(initialState as {movements:unknown}).movements);
  });

  await t.test('Published themed store keeps public catalog, secure COD checkout and stock',async()=>{
   assert.equal((await post('/api/v1/onboarding',{
    action:'details',name:'Soleil de Gabès',phone:'22123456',
    address:'Gabès, rue Principale',description:'Une boutique tunisienne',shipping:7000
   },cookie)).status,200);
   assert.equal((await post('/api/v1/onboarding',{action:'publish'},cookie)).status,200);
   const publicPage=await get('/boutiques/soleil-de-gabes');
   assert.equal(publicPage.status,200);
   const html=await publicPage.text();
   assert.ok(html.includes('data-theme="prestige"'));
   assert.ok(html.includes('#244A77'));
   assert.ok(html.includes('NOUVELLE COLLECTION'));
   assert.ok(html.includes('Sac en cuir'));
   assert.ok(html.includes(design.logoUrl));
   assert.ok(html.includes(design.bannerUrl));
   const shop=(await (await get('/api/commerce',cookie)).json()).state;
   const productId=shop.products[0].id;
   const receipt=await post('/api/boutiques/soleil-de-gabes/checkout',{
    requestId:crypto.randomUUID(),
    customer:{name:'Client Gabès',phone:'22123456',city:'Tunis',address:'Avenue Habib Bourguiba'},
    items:[{productId,quantity:2}]
   });
   assert.equal(receipt.status,201);
   const after=(await (await get('/api/commerce',cookie)).json()).state;
   assert.equal(after.orders.length,1);
   assert.equal(after.orders[0].status,'TO_CONFIRM');
   assert.equal(after.products[0].stock,6);
   assert.equal(after.appearance.theme,'prestige');
  });

  await t.test('Appearance belongs only to the signed-in shop owner',async()=>{
   const cookie2=await register('another@example.test','store-sousse');
   const fresh=(await (await get('/api/v1/appearance',cookie2)).json()).store;
   assert.equal(fresh.appearance.theme,'classic');
   assert.equal(fresh.sampleProducts.length,0);
   assert.equal((await post('/api/v1/appearance',{...design,shopId:'soleil-de-gabes'},cookie2)).status,400);
   const secondDesign={...design,theme:'pop',accent:'#633D81'};
   assert.equal((await post('/api/v1/appearance',secondDesign,cookie2)).status,200);
   assert.equal((await (await get('/api/v1/appearance',cookie)).json()).store.appearance.theme,'prestige');
   assert.equal((await (await get('/api/v1/appearance',cookie2)).json()).store.appearance.theme,'pop');
   const adminUser=await prisma.user.findUniqueOrThrow({where:{email:'platform@example.test'}});
   assert.equal(adminUser.role,'ADMIN');
  });

 }finally{
  stopTestServer(child);
  await prisma.$disconnect();
 }
});
