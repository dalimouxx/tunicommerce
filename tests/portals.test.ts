import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {Prisma} from '@prisma/client';
import {setTimeout as delay} from 'node:timers/promises';

const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('_test'))throw Error('Dedicated *_test database required');
process.env.DATABASE_URL=url;

const {prisma}=await import('../modules/storage/client');
const {hashPassword}=await import('../modules/auth/crypto');
const {initialState}=await import('../modules/commerce/seed');
const base='http://127.0.0.1:3147';
const origin='https://test.local';
const password='Portal-test-password-2026';
const setupToken=randomBytes(32).toString('hex');
let child:ChildProcess|undefined;

const get=(path:string,cookie='',redirect:'manual'|'follow'='manual')=>fetch(base+path,{headers:{cookie},redirect});
const post=(path:string,cookie:string,body:unknown)=>fetch(base+path,{
 method:'POST',headers:{origin,cookie,'content-type':'application/json'},
 body:JSON.stringify(body),redirect:'manual'
});
async function cookieFor(email:string){
 const response=await post('/api/auth/login','',{email,password});
 assert.equal(response.status,200);
 return response.headers.get('set-cookie')!.split(';')[0];
}
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

test('Platform, merchant and public shop portals stay strictly separate',async t=>{
 try{
  await reset();
  child=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3147',DATABASE_URL:url,APP_URL:origin,SETUP_TOKEN:setupToken},
   stdio:'ignore'
  });
  let ready=false;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error('Server exited');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true,'Next.js HTTP server ready');

  await t.test('Anonymous visitors see login; no protected data leaked',async()=>{
   const root=await get('/');
   assert.equal(root.status,307);
   assert.ok(root.headers.get('location')?.includes('/login'));
   assert.equal((await get('/admin')).status,307);
   assert.equal((await get('/marchand')).status,307);
   assert.equal((await get('/admin/gestion-boutiques')).status,307);
   assert.equal((await get('/boutiques')).status,200);
  });

  assert.equal((await post('/api/auth/setup','',{
   email:'admin@example.test',name:'Platform Owner',password,token:setupToken
  })).status,201);
  const adminCookie=await cookieFor('admin@example.test');

  await t.test('Superadministrator enters platform instead of a fake personal shop',async()=>{
   const home=await get('/',adminCookie);
   assert.equal(home.status,307);
   assert.ok(home.headers.get('location')?.endsWith('/admin'));
   const merchant=await get('/marchand',adminCookie);
   assert.equal(merchant.status,307);
   assert.ok(merchant.headers.get('location')?.endsWith('/admin'));
   const admin=await get('/admin',adminCookie);
   assert.equal(admin.status,200);
   const html=await admin.text();
   assert.ok(html.includes('Administration globale'));
   assert.ok(html.includes('Aucune boutique marchande pour le moment'));
   assert.ok(html.includes('Gestion centrale'));
   assert.ok(!html.includes('Vue d’ensemble</h1>'));
   const management=await get('/admin/gestion-boutiques',adminCookie);
   assert.equal(management.status,200);
   assert.ok((await management.text()).includes('Créer une boutique et son marchand'));
   assert.equal(await prisma.workspace.count(),0,'No phantom workspace for platform administrator');
  });

  const shopInput={
   action:'create',name:'Sousse Merchant',email:'merchant@example.test',
   password,shopName:'Sousse Mode',slug:'sousse-mode',published:true,
   plan:'PRO',subscriptionStatus:'ACTIVE',
   subscriptionEndsAt:new Date(Date.now()+30*86400000).toISOString()
  };
  assert.equal((await post('/api/admin/shops',adminCookie,shopInput)).status,200);
  const merchantCookie=await cookieFor(shopInput.email);

  await t.test('Merchant uses only private commerce and sees real public storefront',async()=>{
   assert.equal((await get('/',merchantCookie)).status,307);
   assert.ok((await get('/',merchantCookie)).headers.get('location')?.endsWith('/marchand'));
   assert.equal((await get('/admin',merchantCookie)).status,307);
   assert.ok((await get('/admin',merchantCookie)).headers.get('location')?.endsWith('/marchand'));
   assert.equal((await get('/admin/gestion-boutiques',merchantCookie)).status,307);
   const merchant=await get('/marchand',merchantCookie);
   assert.equal(merchant.status,200);
   const html=await merchant.text();
   assert.ok(html.includes('Espace marchand'));
   assert.ok(html.includes('Voir ma boutique publiée'));
   assert.ok(html.includes('Équipe et accès'));
   assert.ok(!html.includes('Administration globale</a>'));
   const catalog=await get('/boutiques/sousse-mode');
   assert.equal(catalog.status,200);
   assert.ok((await catalog.text()).includes('Sousse Mode'));
   const directory=await get('/boutiques');
   assert.equal(directory.status,200);
   assert.ok((await directory.text()).includes('Sousse Mode'));
   const admin=await get('/admin',adminCookie);
   assert.equal(admin.status,200);
   const adminHtml=await admin.text();
   assert.ok(adminHtml.includes('Sousse Mode'));
   assert.ok(adminHtml.includes('Sousse Merchant'));
   assert.ok(!adminHtml.includes('admin@example.test</small></td>'));
   assert.equal(await prisma.workspace.count(),1);
  });

  await t.test('Members invited to a team do not create phantom merchant shops',async()=>{
   const user=await prisma.user.create({data:{
    email:'employee@example.test',name:'Team Member',passwordHash:await hashPassword(password),role:'MERCHANT'
   }});
   const admin=await prisma.user.findUniqueOrThrow({where:{email:'admin@example.test'}});
   const org=await prisma.organization.create({data:{name:'Sousse Org',ownerId:admin.id}});
   await prisma.shop.create({data:{
    organizationId:org.id,name:'Team Test Shop',slug:'team-test-shop',
    memberships:{create:{userId:user.id,role:'VIEWER'}}
   }});
   const memberCookie=await cookieFor('employee@example.test');
   const member=await get('/marchand',memberCookie);
   assert.equal(member.status,307);
   assert.ok(member.headers.get('location')?.endsWith('/equipe'));
   assert.equal(await prisma.workspace.count(),1);
   assert.equal((await get('/equipe',memberCookie)).status,200);
   assert.equal((await get('/admin',memberCookie)).status,307);
  });
  await t.test('Existing platform-owned public demo store is clearly identified, not hidden',async()=>{
   const adminUser=await prisma.user.findUniqueOrThrow({where:{email:'admin@example.test'}});
   const state=initialState(false);
   state.shop.name='Demo Store';
   await prisma.workspace.create({data:{
    ownerId:adminUser.id,data:state as unknown as Prisma.InputJsonValue,
    slug:'platform-demo',published:true,plan:'STARTER',subscriptionStatus:'TRIAL',
    subscriptionEndsAt:new Date(Date.now()+30*86400000)
   }});
   const response=await get('/admin',adminCookie);
   assert.equal(response.status,200);
   const html=await response.text();
   assert.ok(html.includes('Demo Store'));
   assert.ok(html.includes('Boutique historique du compte plateforme'));
   assert.ok(html.includes('platform-demo'));
   const managed=await get('/admin/gestion-boutiques',adminCookie);
   assert.equal(managed.status,200);
   assert.ok((await managed.text()).includes('Demo Store'));
   assert.equal((await get('/boutiques/platform-demo')).status,200);
   assert.equal(await prisma.user.count({where:{role:'MERCHANT'}}),2);
  });
 }finally{
  child?.kill('SIGTERM');
  await prisma.$disconnect();
 }
});
