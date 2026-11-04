import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test'))
 throw Error('Dedicated *_test PostgreSQL database is required');
process.env.DATABASE_URL=database;
const {prisma}=await import('../modules/storage/client');
const origin='https://test.local';
const base='http://127.0.0.1:3171';
const token=randomBytes(32).toString('hex');
const password='Admin-Platform-Safe-2026!';
let server:ChildProcess|undefined;

const get=(path:string,cookie='')=>fetch(base+path,{redirect:'manual',headers:{cookie}});
const post=(path:string,data:unknown,cookie='',requestOrigin=origin)=>fetch(base+path,{
 method:'POST',redirect:'manual',
 headers:{origin:requestOrigin,'content-type':'application/json',cookie},
 body:JSON.stringify(data)
});
const date=new Date(Date.now()+28*86400000).toISOString();
const config=(slug:string)=>({
 slug,published:false,plan:'PRO',subscriptionStatus:'TRIAL',
 subscriptionEndsAt:date
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

test('Global SaaS admin: merchant directory, subscription control, linked shops and security',async t=>{
 try{
  await reset();
  server=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,PORT:'3171',NODE_ENV:'production',DATABASE_URL:database,APP_URL:origin,SETUP_TOKEN:token},
   stdio:'ignore'
  });
  let ready=false;
  for(let attempt=0;attempt<120;attempt++){
   if(server.exitCode!==null)throw Error('Next server exited before tests');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true,'Next production server ready');

  await t.test('Global admin routes and actions are not public',async()=>{
   for(const path of ['/admin','/admin/marchands','/admin/abonnements','/admin/abonnements/complet','/admin/journal','/admin/gestion-boutiques'])
    assert.equal((await get(path)).status,307,path);
   assert.equal((await get('/admin/boutiques/00000000-0000-4000-8000-000000000000')).status,307);
   assert.equal((await post('/api/admin/shops',{action:'link',id:'00000000-0000-4000-8000-000000000000'})).status,401);
   assert.equal((await get('/api/admin/subscriptions/export')).status,401);
  });

  const setup=await post('/api/auth/setup',{
   name:'Admin Supervision',email:'admin@example.test',password,token
  });
  assert.equal(setup.status,201);
  const login=await post('/api/auth/login',{email:'admin@example.test',password});
  assert.equal(login.status,200);
  const adminCookie=login.headers.get('set-cookie')!.split(';')[0];

  await t.test('New overview and directories load with empty stats',async()=>{
   const home=await get('/admin',adminCookie);
   assert.equal(home.status,200);
   const markup=await home.text();
   assert.ok(markup.includes('Vue globale de la plateforme'));
   assert.ok(markup.includes('Journal d’activité'));
   assert.ok(markup.includes('Marchands'));
   assert.equal((await get('/admin/marchands',adminCookie)).status,200);
   assert.equal((await get('/admin/abonnements',adminCookie)).status,200);
   assert.equal((await get('/admin/abonnements/complet',adminCookie)).status,200);
   assert.equal((await get('/api/admin/subscriptions/export',adminCookie)).status,200);
   assert.equal((await get('/admin/journal',adminCookie)).status,200);
   assert.equal((await get('/admin/gestion-boutiques',adminCookie)).status,200);
  });

  let merchantWorkspaceId='';
  let merchantId='';
  await t.test('Creating merchant from admin atomically creates organization, linked Shop and OWNER membership',async()=>{
   const creation={
    action:'create',name:'Marchand Gabès',email:'gabes@example.test',
    password,shopName:'Galerie Gabès',...config('galerie-gabes')
   };
   const response=await post('/api/admin/shops',creation,adminCookie);
   assert.equal(response.status,200);
   merchantWorkspaceId=(await response.json()).workspaceId;
   const merchant=await prisma.user.findUniqueOrThrow({where:{email:creation.email}});
   merchantId=merchant.id;
   assert.equal(merchant.role,'MERCHANT');
   const workspace=await prisma.workspace.findUniqueOrThrow({where:{id:merchantWorkspaceId}});
   assert.equal(workspace.ownerId,merchantId);
   assert.equal(workspace.plan,'PRO');
   const shop=await prisma.shop.findUniqueOrThrow({
    where:{legacyWorkspaceId:merchantWorkspaceId},include:{organization:true,memberships:true}
   });
   assert.equal(shop.slug,'galerie-gabes');
   assert.equal(shop.organization.ownerId,merchant.id);
   assert.equal(shop.status,'DRAFT');
   assert.equal(shop.memberships.length,1);
   assert.equal(shop.memberships[0].role,'OWNER');
   assert.equal(shop.memberships[0].userId,merchant.id);
   assert.equal(await prisma.organization.count(),1);
   assert.equal((await get('/admin/boutiques/'+merchantWorkspaceId,adminCookie)).status,200);
   const merchantsPage=await (await get('/admin/marchands',adminCookie)).text();
   assert.ok(merchantsPage.includes('Marchand Gabès'));
   const plansPage=await (await get('/admin/abonnements',adminCookie)).text();
   assert.ok(plansPage.includes('Galerie Gabès'));
   const fullPage=await get('/admin/abonnements/complet?statut=valid&recherche=gabes',adminCookie);
   assert.equal(fullPage.status,200);
   const csv=await get('/api/admin/subscriptions/export?statut=valid&recherche=gabes',adminCookie);
   assert.equal(csv.status,200);
   assert.match(csv.headers.get('content-type')||'',/text\\/csv/);
   assert.match(csv.headers.get('cache-control')||'',/no-store/);
   assert.match(await csv.text(),/gabes@example.test/);
  });

  let merchantCookie='';
  await t.test('Merchant cannot access global admin or mutate another shop subscription',async()=>{
   const login=await post('/api/auth/login',{email:'gabes@example.test',password});
   assert.equal(login.status,200);
   merchantCookie=login.headers.get('set-cookie')!.split(';')[0];
   for(const path of ['/admin','/admin/marchands','/admin/abonnements','/admin/abonnements/complet','/admin/journal','/admin/gestion-boutiques','/admin/boutiques/'+merchantWorkspaceId])
    assert.equal((await get(path,merchantCookie)).status,307,path);
   assert.equal((await get('/api/admin/subscriptions/export',merchantCookie)).status,403);
   assert.equal((await post('/api/admin/shops',{action:'update',id:merchantWorkspaceId,...config('galerie-gabes')},merchantCookie)).status,403);
   assert.equal((await post('/api/admin/shops',{action:'link',id:merchantWorkspaceId},merchantCookie)).status,403);
   assert.equal((await post('/api/admin/shops',{action:'link',id:merchantWorkspaceId},adminCookie,'https://wrong-origin.test')).status,403);
  });

  await t.test('Subscription and public slug changes keep relational Shop in sync',async()=>{
   const update={action:'update',id:merchantWorkspaceId,...config('galerie-mode-gabes'),published:true,plan:'BUSINESS',subscriptionStatus:'ACTIVE'};
   const response=await post('/api/admin/shops',update,adminCookie);
   assert.equal(response.status,200);
   const workspace=await prisma.workspace.findUniqueOrThrow({where:{id:merchantWorkspaceId}});
   const shop=await prisma.shop.findUniqueOrThrow({where:{legacyWorkspaceId:merchantWorkspaceId}});
   assert.equal(workspace.slug,'galerie-mode-gabes');
   assert.equal(shop.slug,'galerie-mode-gabes');
   assert.equal(workspace.plan,'BUSINESS');
   assert.equal(shop.status,'PUBLISHED');
   const blocked=await post('/api/admin/shops',{
    action:'update',id:merchantWorkspaceId,
    ...config('galerie-mode-gabes'),subscriptionStatus:'SUSPENDED',published:true
   },adminCookie);
   assert.equal(blocked.status,200);
   assert.equal((await get('/boutiques/galerie-mode-gabes')).status,404);
   assert.equal((await get('/admin/abonnements?statut=suspended',adminCookie)).status,200);
   assert.equal((await post('/api/admin/shops',{action:'link',id:merchantWorkspaceId},adminCookie)).status,200);
  });

  await t.test('Admin can explicitly link existing legacy workspace without changing commerce data',async()=>{
   assert.equal((await get('/api/commerce',adminCookie)).status,200);
   const owner=await prisma.user.findUniqueOrThrow({where:{email:'admin@example.test'}});
   const old=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
   assert.equal(await prisma.shop.count({where:{legacyWorkspaceId:old.id}}),0);
   const before=old.data;
   const update=await post('/api/admin/shops',{
    action:'update',id:old.id,...config('personal-admin-shop')
   },adminCookie);
   assert.equal(update.status,200);
   const linking=await post('/api/admin/shops',{action:'link',id:old.id},adminCookie);
   assert.equal(linking.status,200);
   assert.equal((await linking.json()).alreadyLinked,false);
   const again=await post('/api/admin/shops',{action:'link',id:old.id},adminCookie);
   assert.equal(again.status,200);
   assert.equal((await again.json()).alreadyLinked,true);
   const linked=await prisma.shop.findUniqueOrThrow({
    where:{legacyWorkspaceId:old.id},include:{memberships:true}
   });
   assert.equal(linked.slug,'personal-admin-shop');
   assert.equal(linked.memberships[0].userId,owner.id);
   assert.equal(linked.memberships[0].role,'OWNER');
   const after=await prisma.workspace.findUniqueOrThrow({where:{id:old.id}});
   assert.deepEqual(after.data,before,'No legacy commerce data changed');
   assert.equal((await get('/admin/boutiques/'+old.id,adminCookie)).status,200);
   assert.equal((await get('/marchand',adminCookie)).status,200);
   const collision=await post('/api/admin/shops',{
    action:'update',id:old.id,...config('galerie-mode-gabes')
   },adminCookie);
   assert.equal(collision.status,409);
  });

  await t.test('Audit events are persisted and visible only to admin',async()=>{
   assert.ok(await prisma.platformAudit.count()>=4);
   const auditHtml=await (await get('/admin/journal',adminCookie)).text();
   assert.ok(auditHtml.includes('Journal administratif'));
   assert.ok(auditHtml.includes('Galerie Gabès'));
   const detailHtml=await (await get('/admin/boutiques/'+merchantWorkspaceId,adminCookie)).text();
   assert.ok(detailHtml.includes('Offre et accès'));
   assert.ok(detailHtml.includes('Marchand Gabès'));
   assert.ok(!detailHtml.includes(password));
   assert.ok(!detailHtml.includes('passwordHash'));
  });

 }finally{
  server?.kill('SIGTERM');
  await prisma.$disconnect();
 }
});
