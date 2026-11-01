import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test'))throw Error('Use an isolated *_test database only');
process.env.DATABASE_URL=database;
const {prisma}=await import('../modules/storage/client');
const base='http://127.0.0.1:3158';
const origin='https://test.local';
const setupToken=randomBytes(32).toString('hex');
const password='Media-test-password-2026!';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');
let child:ChildProcess|undefined;
const get=(path:string,cookie='')=>fetch(base+path,{headers:{cookie},redirect:'manual'});
const post=(path:string,body:unknown,cookie='',sentOrigin=origin)=>fetch(base+path,{
 method:'POST',
 headers:{origin:sentOrigin,cookie,'content-type':'application/json'},
 body:JSON.stringify(body),redirect:'manual'
});
const put=(slot:string,bytes:Buffer,cookie='',mime='image/png',sentOrigin=origin)=>fetch(base+'/api/v1/media/'+slot,{
 method:'PUT',
 headers:{origin:sentOrigin,cookie,'content-type':mime},
 body:new Blob([new Uint8Array(bytes)]),redirect:'manual'
});
async function clean(){
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
async function signup(email:string,slug:string){
 const res=await post('/api/auth/register',{email,password,name:'Marchand Essai',shopName:'Boutique Essai',slug});
 assert.equal(res.status,201);
 return res.headers.get('set-cookie')!.split(';')[0];
}

test('Direct shop-brand uploads persist with privacy and preserve commerce',async t=>{
 try{
  await clean();
  child=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3158',DATABASE_URL:database,APP_URL:origin,SETUP_TOKEN:setupToken},
   stdio:'ignore'
  });
  let ready=false;
  for(let attempt=0;attempt<120;attempt++){
   if(child.exitCode!==null)throw Error('Next production server exited');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true);

  await t.test('Unauthorized uploads are rejected before content is persisted',async()=>{
   assert.equal((await put('logo',png)).status,401);
   assert.equal((await put('logo',png,'','image/png','https://evil.test')).status,403);
   assert.equal((await get('/api/media/assets/00000000-0000-4000-8000-000000000000')).status,404);
   const setup=await post('/api/auth/setup',{email:'platform@example.test',name:'Admin',password,token:setupToken});
   assert.equal(setup.status,201);
   const admin=await post('/api/auth/login',{email:'platform@example.test',password});
   assert.equal(admin.status,200);
   const adminCookie=admin.headers.get('set-cookie')!.split(';')[0];
   assert.equal((await put('logo',png,adminCookie)).status,403);
  });

  const ownerCookie=await signup('owner@example.test','logo-gabes');
  const otherCookie=await signup('other@example.test','logo-sousse');
  let logoUrl='';let bannerUrl='';

  await t.test('Server refuses SVG, GIF, mismatched MIME, invalid dimensions and huge bytes',async()=>{
   assert.equal((await put('logo',Buffer.from('<svg onload="alert(1)"/>'),ownerCookie,'image/svg+xml')).status,415);
   assert.equal((await put('logo',Buffer.from('<svg/>'),ownerCookie)).status,415);
   assert.equal((await put('banner',Buffer.from('GIF89a'),ownerCookie,'image/gif')).status,415);
   const huge=Buffer.from(png);huge.writeUInt32BE(6100,16);
   assert.equal((await put('banner',huge,ownerCookie)).status,422);
   assert.equal((await put('logo',Buffer.alloc(700*1024+1),ownerCookie)).status,413);
   assert.equal((await put('invalid',png,ownerCookie)).status,400);
   assert.equal(await prisma.shopMedia.count(),0);
  });

  await t.test('Owner imports logo and banner directly; stable URLs, bounded database records',async()=>{
   const logo=await put('logo',png,ownerCookie);
   assert.equal(logo.status,201);
   const first=await logo.json();
   logoUrl=first.url;
   assert.match(logoUrl,/^\/api\/media\/assets\/[a-f0-9-]{36}$/);
   assert.equal(first.slot,'logo');
   const banner=await put('banner',png,ownerCookie);
   assert.equal(banner.status,201);
   bannerUrl=(await banner.json()).url;
   assert.notEqual(logoUrl,bannerUrl);
   const again=await put('logo',png,ownerCookie);
   assert.equal(again.status,201);
   assert.equal((await again.json()).url,logoUrl);
   assert.equal(await prisma.shopMedia.count(),2);
   assert.equal((await get(logoUrl)).status,404,'Draft images must not be public');
   assert.equal((await get(logoUrl,otherCookie)).status,404,'Another merchant cannot read draft image');
   const loaded=await get(logoUrl,ownerCookie);
   assert.equal(loaded.status,200);
   assert.equal(loaded.headers.get('content-type'),'image/png');
   assert.equal(loaded.headers.get('cache-control'),'private, no-store');
   assert.deepEqual(Buffer.from(await loaded.arrayBuffer()),png);
   const appearance=(await (await get('/api/v1/appearance',ownerCookie)).json()).store;
   assert.equal(appearance.logoUrl,logoUrl);
   assert.equal(appearance.bannerUrl,bannerUrl);
   assert.equal(appearance.appearance.theme,'classic');
   const shop=(await (await get('/api/commerce',ownerCookie)).json()).state;
   assert.equal(shop.shop.logoUrl,logoUrl);
   assert.equal(shop.shop.bannerUrl,bannerUrl);
  });

  await t.test('Only owner can save private image paths; other merchants remain isolated',async()=>{
   const design={theme:'prestige',accent:'#633D81',
    eyebrow:'BOUTIQUE GABÈS',tagline:'Payer à la livraison',description:'Boutique tunisienne',
    logoUrl,bannerUrl
   };
   const result=await post('/api/v1/appearance',design,ownerCookie);
   assert.equal(result.status,200);
   assert.equal((await post('/api/v1/appearance',design,otherCookie)).status,403);
   assert.equal((await post('/api/v1/appearance',{...design,logoUrl:'javascript:alert(1)'},ownerCookie)).status,400);
   const other=(await (await get('/api/v1/appearance',otherCookie)).json()).store;
   assert.equal(other.logoUrl,'');
   assert.equal(other.appearance.theme,'classic');
   const owner=(await (await get('/api/v1/appearance',ownerCookie)).json()).store;
   assert.equal(owner.appearance.theme,'prestige');
  });

  await t.test('When published, uploaded brand images load for shoppers and checkout COD still works',async()=>{
   assert.equal((await post('/api/v1/onboarding',{action:'details',name:'Boutique Gabès',
    phone:'+216 22 000 111',address:'Gabès, Centre',description:'Vêtements',shipping:7000
   },ownerCookie)).status,200);
   const product=await post('/api/commerce',{action:'product',requestId:crypto.randomUUID(),
    payload:{name:'Produit coton',sku:'MED-100',category:'Textile',variant:'Standard',price:49900,cost:21000,stock:9,threshold:2,color:'#CCCCCC'}
   },ownerCookie);
   assert.equal(product.status,200);
   assert.equal((await post('/api/v1/onboarding',{action:'publish'},ownerCookie)).status,200);
   const page=await get('/boutiques/logo-gabes');
   assert.equal(page.status,200);
   const html=await page.text();
   assert.ok(html.includes('data-theme="prestige"'));
   assert.ok(html.includes(logoUrl));
   assert.ok(html.includes(bannerUrl));
   assert.ok(html.includes('Produit coton'));
   const publicAsset=await get(logoUrl);
   assert.equal(publicAsset.status,200);
   assert.equal(publicAsset.headers.get('content-type'),'image/png');
   const state=(await (await get('/api/commerce',ownerCookie)).json()).state;
   const receipt=await post('/api/boutiques/logo-gabes/checkout',{
    requestId:crypto.randomUUID(),
    customer:{name:'Client Test',phone:'22123456',city:'Tunis',address:'Rue 10'},
    items:[{productId:state.products[0].id,quantity:2}]
   });
   assert.equal(receipt.status,201);
   const after=(await (await get('/api/commerce',ownerCookie)).json()).state;
   assert.equal(after.orders.length,1);
   assert.equal(after.products[0].stock,7);
   assert.equal(after.shop.logoUrl,logoUrl);
   assert.equal((await post('/api/v1/onboarding',{action:'unpublish'},ownerCookie)).status,200);
   assert.equal((await get(logoUrl)).status,404);
   assert.equal((await get(logoUrl,ownerCookie)).status,200);
  });
 }finally{
  child?.kill('SIGTERM');
  await prisma.$disconnect();
 }
});
