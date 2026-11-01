import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const db=process.env.TEST_DATABASE_URL;
if(!db||!new URL(db).pathname.endsWith('_test'))
 throw Error('Product-photo regression requires a dedicated *_test PostgreSQL database');
process.env.DATABASE_URL=db;
const {prisma}=await import('../modules/storage/client');
const {PHOTO_MAX_BYTES}=await import('../modules/product-media/validation');

const origin='https://test.local';
const base='http://127.0.0.1:3162';
const password='Safe-Photo-Product-Test-2026!';
const setupToken=randomBytes(32).toString('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');
let server:ChildProcess|undefined;

const get=(path:string,cookie='')=>fetch(base+path,{headers:{cookie},redirect:'manual'});
const post=(path:string,body:unknown,cookie='',sentOrigin=origin)=>fetch(base+path,{
 method:'POST',headers:{origin:sentOrigin,cookie,'content-type':'application/json'},
 body:JSON.stringify(body),redirect:'manual'
});
const put=(bytes:Buffer,cookie='',mime='image/png',sentOrigin=origin)=>fetch(base+'/api/v1/product-media',{
 method:'PUT',headers:{origin:sentOrigin,cookie,'content-type':mime},
 body:new Blob([new Uint8Array(bytes)]),redirect:'manual'
});
const del=(id:string,cookie='',sentOrigin=origin)=>fetch(base+'/api/v1/product-media/'+id,{
 method:'DELETE',headers:{origin:sentOrigin,cookie},redirect:'manual'
});

async function reset(){
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

async function merchant(email:string,slug:string){
 const res=await post('/api/auth/register',{
  name:'Marchand Test',email,password,shopName:'Boutique Test',slug
 });
 assert.equal(res.status,201);
 return res.headers.get('set-cookie')!.split(';')[0];
}

function product(imageUrl:string,id?:string){
 return {
  ...(id?{id}:{}),
  name:'Pochette téléphone',sku:'PROD-TEST-1',category:'Accessoires',
  variant:'Noir',price:39000,cost:14000,stock:9,
  threshold:2,color:'#AACCEE',description:'Protection de téléphone',
  imageUrl
 };
}

test('Merchant product photo library: isolation, stock, COD and quotas',async t=>{
 try{
  await reset();
  server=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3162',DATABASE_URL:db,APP_URL:origin,SETUP_TOKEN:setupToken},
   stdio:'ignore'
  });
  let ready=false;
  for(let i=0;i<120;i++){
   if(server.exitCode!==null)throw Error('Next.js exited before tests');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true);

  await t.test('Anonymous and admin cannot list or upload; CSRF is enforced',async()=>{
   assert.equal((await get('/api/v1/product-media')).status,401);
   assert.equal((await put(png)).status,401);
   assert.equal((await put(png,'','image/png','https://evil.test')).status,403);
   assert.equal((await get('/mediatheque')).status,307);
   const setup=await post('/api/auth/setup',{
    name:'Platform admin',email:'admin@example.test',password,token:setupToken
   });
   assert.equal(setup.status,201);
   const login=await post('/api/auth/login',{email:'admin@example.test',password});
   assert.equal(login.status,200);
   const adminCookie=login.headers.get('set-cookie')!.split(';')[0];
   assert.equal((await get('/api/v1/product-media',adminCookie)).status,403);
   assert.equal((await put(png,adminCookie)).status,403);
  });

  const ownerCookie=await merchant('owner@example.test','product-owner');
  const foreignCookie=await merchant('foreign@example.test','product-foreign');
  let url='';let id='';

  await t.test('Owner sees empty private media library; invalid uploads are refused',async()=>{
   const r=await get('/api/v1/product-media',ownerCookie);
   assert.equal(r.status,200);
   const content=await r.json();
   assert.equal(content.photos.length,0);
   assert.equal(content.limit,30);
   assert.equal((await get('/mediatheque',ownerCookie)).status,200);
   assert.equal((await put(Buffer.from('<svg onload="x"/>'),ownerCookie,'image/svg+xml')).status,415);
   assert.equal((await put(Buffer.from('not a PNG'),ownerCookie)).status,415);
   assert.equal((await put(Buffer.alloc(PHOTO_MAX_BYTES+1),ownerCookie)).status,413);
   assert.equal((await put(png,ownerCookie,'image/png','https://evil.test')).status,403);
   assert.equal((await prisma.productMedia.count()),0);
  });

  await t.test('Owner can upload, list, and privately preview one reusable photo',async()=>{
   const r=await put(png,ownerCookie);
   assert.equal(r.status,201);
   const photo=await r.json();
   url=photo.url;id=photo.id;
   assert.ok(url.startsWith('/api/media/products/'));
   assert.equal(photo.size,png.byteLength);
   assert.equal((await get(url)).status,404,'Unpublished product photo is private');
   assert.equal((await get(url,foreignCookie)).status,404);
   const privateImage=await get(url,ownerCookie);
   assert.equal(privateImage.status,200);
   assert.equal(privateImage.headers.get('cache-control'),'private, no-store');
   assert.equal(privateImage.headers.get('content-type'),'image/png');
   assert.deepEqual(Buffer.from(await privateImage.arrayBuffer()),png);
   const list=(await (await get('/api/v1/product-media',ownerCookie)).json()).photos;
   assert.equal(list.length,1);
   assert.equal(list[0].url,url);
   assert.equal((await (await get('/api/v1/product-media',foreignCookie)).json()).photos.length,0);
  });

  await t.test('Another merchant cannot attach or delete the first shop image',async()=>{
   const stolen=await post('/api/commerce',{
    action:'product',payload:product(url),requestId:randomUUID()
   },foreignCookie);
   assert.equal(stolen.status,403);
   assert.equal((await del(id,foreignCookie)).status,404);
   assert.equal((await del(id,ownerCookie,'https://evil.test')).status,403);
   assert.equal((await prisma.productMedia.count()),1);
  });

  await t.test('Attaching photo to product preserves commerce data and protects referenced image',async()=>{
   const saved=await post('/api/commerce',{
    action:'product',payload:product(url),requestId:randomUUID()
   },ownerCookie);
   assert.equal(saved.status,200);
   const catalog=(await saved.json()).state;
   assert.equal(catalog.products.length,1);
   assert.equal(catalog.products[0].imageUrl,url);
   assert.equal(catalog.products[0].stock,9);
   const blocked=await del(id,ownerCookie);
   assert.equal(blocked.status,409);
  });

  await t.test('Publishing makes the image public and does not alter COD ordering',async()=>{
   assert.equal((await post('/api/v1/onboarding',{
    action:'details',name:'Boutique Test',phone:'22123456',
    address:'Gabès, rue principale',description:'Une boutique de tests',shipping:7000
   },ownerCookie)).status,200);
   assert.equal((await post('/api/v1/onboarding',{action:'publish'},ownerCookie)).status,200);
   const storefront=await get('/boutiques/product-owner');
   assert.equal(storefront.status,200);
   assert.ok((await storefront.text()).includes(url));
   const publicImage=await get(url);
   assert.equal(publicImage.status,200);
   assert.equal(publicImage.headers.get('cache-control'),'public, max-age=60, must-revalidate');
   const state=(await (await get('/api/commerce',ownerCookie)).json()).state;
   const sold=await post('/api/boutiques/product-owner/checkout',{
    requestId:randomUUID(),
    customer:{name:'Client réel',phone:'22123456',city:'Tunis',address:'Rue du centre'},
    items:[{productId:state.products[0].id,quantity:2}]
   });
   assert.equal(sold.status,201);
   const after=(await (await get('/api/commerce',ownerCookie)).json()).state;
   assert.equal(after.orders.length,1);
   assert.equal(after.products[0].stock,7);
   assert.equal(after.products[0].imageUrl,url);
  });

  await t.test('Deleting only an unused image keeps product and COD history unchanged',async()=>{
   const before=(await (await get('/api/commerce',ownerCookie)).json()).state;
   assert.equal((await post('/api/commerce',{
    action:'product',payload:product('',before.products[0].id),requestId:randomUUID()
   },ownerCookie)).status,200);
   assert.equal((await del(id,ownerCookie)).status,200);
   assert.equal((await get(url)).status,404);
   assert.equal((await get(url,ownerCookie)).status,404);
   assert.equal((await (await get('/api/v1/product-media',ownerCookie)).json()).photos.length,0);
   const after=(await (await get('/api/commerce',ownerCookie)).json()).state;
   assert.equal(after.products[0].stock,7);
   assert.equal(after.products[0].imageUrl,'');
   assert.equal(after.orders.length,1);
  });

  await t.test('30-photo quota is enforced even if user attempts to add a 31st image',async()=>{
   const owner=await prisma.user.findUniqueOrThrow({where:{email:'owner@example.test'}});
   const workspace=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
   await prisma.productMedia.createMany({data:Array.from({length:30},()=>({
    workspaceId:workspace.id,mimeType:'image/png',content:new Uint8Array(png),
    size:png.byteLength,width:1,height:1
   }))});
   const over=await put(png,ownerCookie);
   assert.equal(over.status,409);
   assert.equal(await prisma.productMedia.count({where:{workspaceId:workspace.id}}),30);
   assert.equal((await (await get('/api/v1/product-media',ownerCookie)).json()).photos.length,30);
   assert.equal((await (await get('/api/v1/product-media',foreignCookie)).json()).photos.length,0);
  });
 }finally{
  server?.kill('SIGTERM');
  await prisma.$disconnect();
 }
});
