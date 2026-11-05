import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const db=process.env.TEST_DATABASE_URL;
if(!db||!new URL(db).pathname.endsWith('_test'))
 throw Error('Use an isolated *_test PostgreSQL database');
process.env.DATABASE_URL=db;
const {prisma}=await import('../modules/storage/client');
const base='http://127.0.0.1:3164';
const origin='https://test.local';
const password='Admin-Personal-Shop-Safe-2026!';
const setupToken=randomBytes(32).toString('hex');
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');
let child:ChildProcess|undefined;

const get=(path:string,cookie='')=>fetch(base+path,{headers:{cookie},redirect:'manual'});
const post=(path:string,payload:unknown,cookie='',requestOrigin=origin)=>fetch(base+path,{
 method:'POST',headers:{'content-type':'application/json',origin:requestOrigin,cookie},
 body:JSON.stringify(payload),redirect:'manual'
});
const put=(path:string,body:Uint8Array,cookie='',requestOrigin=origin)=>fetch(base+path,{
 method:'PUT',headers:{origin:requestOrigin,cookie,'content-type':'image/png'},
 body:new Blob([new Uint8Array(body)]),redirect:'manual'
});
async function resetDatabase(){
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
}
async function merchantAccount(){
 const response=await post('/api/auth/register',{
  name:'Marchand séparé',shopName:'Boutique Externe',slug:'boutique-externe',
  email:'merchant@example.test',password
 });
 assert.equal(response.status,201);
 return response.headers.get('set-cookie')!.split(';')[0];
}

test('Super-admin can manage only their own legacy boutique and still access global administration',async t=>{
 try{
  await resetDatabase();
  child=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3164',DATABASE_URL:db,APP_URL:origin,SETUP_TOKEN:setupToken},
   stdio:'ignore'
  });
  let ready=false;
  for(let tries=0;tries<120;tries++){
   if(child.exitCode!==null)throw new Error('Server exited before tests');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true);
  await t.test('Anonymous requests are redirected or refused',async()=>{
   assert.equal((await get('/marchand')).status,307);
   assert.equal((await get('/admin')).status,307);
   assert.equal((await get('/api/v1/appearance')).status,401);
   assert.equal((await put('/api/v1/media/logo',new Uint8Array(image))).status,401);
  });

  const setup=await post('/api/auth/setup',{
   name:'Administrateur plateforme',email:'platform@example.test',password,token:setupToken
  });
  assert.equal(setup.status,201);
  const login=await post('/api/auth/admin/login',{email:'platform@example.test',password});
  assert.equal(login.status,200);
  const adminCookie=login.headers.get('set-cookie')!.split(';')[0];
  const shopLogin=await post('/api/auth/merchant/login',{email:'platform@example.test',password});
  assert.equal(shopLogin.status,200);
  const shopCookie=shopLogin.headers.get('set-cookie')!.split(';')[0];
  assert.notEqual(adminCookie.split('=')[0],shopCookie.split('=')[0]);
  assert.equal((await get('/admin',shopCookie)).status,307);


  await t.test('ADMIN without a personally owned workspace cannot access merchant-only controls',async()=>{
   const page=await get('/marchand',shopCookie);
   assert.equal(page.status,307);
   assert.equal(page.headers.get('location'),'/connexion/admin');
   assert.equal((await get('/api/v1/appearance',shopCookie)).status,403);
   assert.equal((await get('/api/v1/onboarding',shopCookie)).status,403);
   assert.equal((await get('/api/v1/product-media',shopCookie)).status,403);
   assert.equal((await put('/api/v1/media/logo',new Uint8Array(image),shopCookie)).status,403);
   assert.equal((await get('/admin',adminCookie)).status,200);
  });

  // The old ADMIN account has an existing personal commerce workspace in production.
  // Simulate this existing state via the established legacy workspace creation route.
  const legacy=await get('/api/commerce',shopCookie);
  assert.equal(legacy.status,200);
  const ownedAdminState=(await legacy.json()).state;
  const adminUser=await prisma.user.findUniqueOrThrow({where:{email:'platform@example.test'}});
  assert.equal(adminUser.role,'ADMIN');
  assert.ok(await prisma.workspace.findUnique({where:{ownerId:adminUser.id}}));

  await t.test('ADMIN with owned Workspace can switch to merchant dashboard and back',async()=>{
   assert.equal((await get('/marchand',shopCookie)).status,200);
   assert.equal((await get('/admin',adminCookie)).status,200);
   assert.equal((await get('/demarrage',shopCookie)).status,200);
   assert.equal((await get('/personnalisation',shopCookie)).status,200);
   assert.equal((await get('/mediatheque',shopCookie)).status,200);
   assert.equal((await get('/api/v1/onboarding',shopCookie)).status,200);
   assert.equal((await get('/api/v1/appearance',shopCookie)).status,200);
   assert.equal((await get('/api/v1/product-media',shopCookie)).status,200);
   const adminHtml=await (await get('/admin',adminCookie)).text();
   assert.ok(adminHtml.includes('Ma boutique personnelle'));
   assert.ok(adminHtml.includes('/connexion/boutique'));
   assert.equal((await get('/api/admin/plans',shopCookie)).status,401);
   const merchantHtml=await (await get('/marchand',shopCookie)).text();
   assert.ok(merchantHtml.includes('Super Admin · connexion indépendante'));
   assert.deepEqual((await (await get('/api/commerce',shopCookie)).json()).state,ownedAdminState);
  });

  let mediaUrl='';
  await t.test('ADMIN may change their own store appearance and upload their own image',async()=>{
   const appearance={
    theme:'pop',accent:'#633D81',eyebrow:'MA BOUTIQUE PERSONNELLE',
    tagline:'Livraison en Tunisie',description:'Boutique personnelle',
    logoUrl:'',bannerUrl:''
   };
   const saved=await post('/api/v1/appearance',appearance,shopCookie);
   assert.equal(saved.status,200);
   const read=await get('/api/v1/appearance',shopCookie);
   assert.equal((await read.json()).store.appearance.theme,'pop');
   const media=await put('/api/v1/media/logo',new Uint8Array(image),shopCookie);
   assert.equal(media.status,201);
   mediaUrl=(await media.json()).url;
   assert.equal((await get(mediaUrl,shopCookie)).status,200);
   assert.equal((await get(mediaUrl)).status,404);
   const upload=await put('/api/v1/product-media',new Uint8Array(image),shopCookie);
   assert.equal(upload.status,201);
   const photos=(await (await get('/api/v1/product-media',shopCookie)).json()).photos;
   assert.equal(photos.length,1);
   assert.equal((await post('/api/v1/appearance',appearance,shopCookie,'https://evil.test')).status,403);
  });

  const foreignCookie=await merchantAccount();
  await t.test('ADMIN own store remains separated from an unrelated merchant',async()=>{
   const merchant=await prisma.user.findUniqueOrThrow({where:{email:'merchant@example.test'}});
   assert.equal(merchant.role,'MERCHANT');
   const foreignStore=await get('/api/commerce',foreignCookie);
   assert.equal(foreignStore.status,200);
   assert.equal((await foreignStore.json()).state.shop.name,'Boutique Externe');
   const ownStore=(await (await get('/api/commerce',shopCookie)).json()).state;
   assert.notEqual(ownStore.shop.name,'Boutique Externe');
   assert.equal((await get('/admin',foreignCookie)).status,307);
   assert.equal((await get('/marchand',foreignCookie)).status,200);
   assert.equal((await get(mediaUrl,foreignCookie)).status,404);
   const malicious=await post('/api/commerce',{
    action:'product',requestId:randomUUID(),
    payload:{
     ownerId:merchant.id,name:'Article personnel',sku:'OWN-001',
     category:'Mode',variant:'Normal',price:29000,cost:10000,stock:3,
     threshold:1,color:'#aabbcc'
    }
   },shopCookie);
   assert.equal(malicious.status,200);
   assert.equal((await malicious.json()).state.products.length,ownedAdminState.products.length+1);
   const after=(await (await get('/api/commerce',foreignCookie)).json()).state;
   assert.equal(after.products.length,0,'No merchant cross-account mutation');
   const global=(await get('/admin',adminCookie));
   assert.equal(global.status,200);
  });

 }finally{
  child?.kill('SIGTERM');
  await prisma.$disconnect();
 }
});
