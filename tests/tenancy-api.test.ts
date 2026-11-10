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
const {hashPassword}=await import('../modules/auth/crypto');

const base='http://127.0.0.1:3141';
const origin='https://test.local';
const secret=randomBytes(32).toString('hex');
const password='Tenancy-test-password-2026';
let child:ChildProcess|undefined;
const post=(path:string,body:unknown,cookie='',from=origin)=>fetch(base+path,{
 method:'POST',headers:{origin:from,'content-type':'application/json',cookie},
 body:JSON.stringify(body),redirect:'manual'
});
const get=(path:string,cookie='')=>fetch(base+path,{headers:{cookie}});
async function cookieFor(email:string,pass:string){
 const r=await post('/api/auth/login',{email,password:pass});
 assert.equal(r.status,200);
 return r.headers.get('set-cookie')!.split(';')[0];
}
async function reset(){
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

test('New tenant API is isolated and legacy commerce remains intact',async t=>{
 try{
  await reset();
  child=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3141',DATABASE_URL:url,APP_URL:origin,SETUP_TOKEN:secret},
   stdio:'ignore'
  });
  let ready=false;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error('Server exited');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.ok(ready,'HTTP server ready');

  await t.test('Anonymous calls and forged origins are rejected',async()=>{
   assert.equal((await get('/api/v1/organizations')).status,401);
   assert.equal((await get('/api/v1/shops')).status,401);
   assert.equal((await post('/api/v1/organizations',{name:'Fake'})).status,401);
   assert.equal((await post('/api/v1/organizations',{name:'Fake'},'', 'https://evil.example')).status,403);
   assert.equal((await post('/api/v1/shops/import-legacy',{})).status,401);
  });

  const setup=await post('/api/auth/setup',{email:'first@example.test',name:'Original Merchant',password,token:secret});
  assert.equal(setup.status,201);
  const ownerCookie=await cookieFor('first@example.test',password);
  const owner=await prisma.user.findUniqueOrThrow({where:{email:'first@example.test'}});

  await t.test('Organization and draft shop creation is owner-scoped',async()=>{
   assert.equal((await post('/api/v1/organizations',{name:' '},ownerCookie)).status,400);
   const created=await post('/api/v1/organizations',{name:'  My Organization  '},ownerCookie);
   assert.equal(created.status,201);
   const org=(await created.json()).organization;
   assert.equal(org.name,'My Organization');
   const list=await (await get('/api/v1/organizations',ownerCookie)).json();
   assert.equal(list.organizations.length,1);
   assert.equal(list.organizations[0].id,org.id);
   const invalid=await post('/api/v1/shops',{organizationId:org.id,name:'Test Shop',slug:'UPPER'},ownerCookie);
   assert.equal(invalid.status,400);
   const createBody={organizationId:org.id,name:'  My Boutique  ',slug:'my-boutique'};
   const shopReply=await post('/api/v1/shops',createBody,ownerCookie);
   assert.equal(shopReply.status,201);
   const shop=(await shopReply.json()).shop;
   assert.equal(shop.status,'DRAFT');
   assert.equal(shop.name,'My Boutique');
   assert.equal((await post('/api/v1/shops',createBody,ownerCookie)).status,409);
   const ownShops=await (await get('/api/v1/shops',ownerCookie)).json();
   assert.equal(ownShops.shops.length,1);
   assert.equal(ownShops.shops[0].role,'OWNER');
   const members=await (await get('/api/v1/shops/'+shop.id+'/members',ownerCookie)).json();
   assert.equal(members.members.length,1);
   assert.equal(members.members[0].user.email,'first@example.test');

   const otherPassword='Different-strong-password-2026';
   await prisma.user.create({data:{email:'second@example.test',name:'Other Merchant',passwordHash:await hashPassword(otherPassword)}});
   const otherCookie=await cookieFor('second@example.test',otherPassword);
   assert.equal((await get('/api/v1/shops',otherCookie)).status,200);
   assert.deepEqual((await (await get('/api/v1/shops',otherCookie)).json()).shops,[]);
   assert.deepEqual((await (await get('/api/v1/organizations',otherCookie)).json()).organizations,[]);
   assert.equal((await get('/api/v1/shops/'+shop.id+'/members',otherCookie)).status,403);
   assert.equal((await post('/api/v1/shops',createBody,otherCookie)).status,403);
   assert.equal((await post('/api/v1/shops/import-legacy',{},otherCookie)).status,404);
  });

  await t.test('Opt-in legacy import is repeatable and does not change Workspace data or version',async()=>{
   const legacy=await get('/api/commerce',ownerCookie);
   assert.equal(legacy.status,200);
   const workspace=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
   await prisma.workspace.update({where:{id:workspace.id},data:{slug:'existing-legacy-slug'}});
   const before=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
   const org=(await (await get('/api/v1/organizations',ownerCookie)).json()).organizations[0];
   assert.equal((await post('/api/v1/shops',{organizationId:org.id,name:'Collision',slug:'existing-legacy-slug'},ownerCookie)).status,409);
   const imported=await post('/api/v1/shops/import-legacy',{},ownerCookie);
   assert.equal(imported.status,201);
   const first=(await imported.json()).shop;
   assert.equal(first.legacyWorkspaceId,workspace.id);
   assert.equal(first.slug,'existing-legacy-slug');
   assert.equal(first.status,'DRAFT');
   const again=await post('/api/v1/shops/import-legacy',{},ownerCookie);
   assert.equal(again.status,200);
   assert.equal((await again.json()).shop.id,first.id);
   const after=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
   assert.equal(after.version,before.version);
   assert.deepEqual(after.data,before.data);
   assert.equal(after.slug,before.slug);
   assert.equal(await prisma.shop.count({where:{legacyWorkspaceId:workspace.id}}),1);
   const commerce=await get('/api/commerce',ownerCookie);
   assert.equal(commerce.status,200);
   assert.deepEqual((await commerce.json()).state,(await legacy.json()).state);
  });

  await t.test('A merchant cannot exceed maxShops by opening another organization',async()=>{
   const workspace=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
   const oldPlan=await prisma.subscriptionPlan.findUniqueOrThrow({where:{code:workspace.plan}});
   const org=await prisma.organization.findFirstOrThrow({where:{ownerId:owner.id}});
   assert.equal(await prisma.shop.count({where:{organization:{ownerId:owner.id}}}),2);
   try{
    await prisma.subscriptionPlan.update({where:{code:workspace.plan},data:{maxShops:2,enabled:true}});
    const denied=await post('/api/v1/shops',{organizationId:org.id,name:'Troisième magasin',slug:'third-store-denied'},ownerCookie);
    assert.equal(denied.status,409);
    assert.match((await denied.json() as {error:string}).error,/Limite de boutiques/);
    const secondOrg=await post('/api/v1/organizations',{name:'Seconde organisation'},ownerCookie);
    assert.equal(secondOrg.status,201);
    const secondOrgId=(await secondOrg.json() as {organization:{id:string}}).organization.id;
    assert.equal((await post('/api/v1/shops',{organizationId:secondOrgId,name:'Autre magasin',slug:'another-shop-denied'},ownerCookie)).status,409);
    await prisma.subscriptionPlan.update({where:{code:workspace.plan},data:{maxShops:3}});
    const allowed=await post('/api/v1/shops',{organizationId:secondOrgId,name:'Autre magasin',slug:'another-shop-allowed'},ownerCookie);
    assert.equal(allowed.status,201);
    assert.equal(await prisma.shop.count({where:{organization:{ownerId:owner.id}}}),3);
    assert.equal((await post('/api/v1/shops',{organizationId:org.id,name:'Encore une boutique',slug:'fourth-shop-denied'},ownerCookie)).status,409);
    const legacy=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
    assert.equal(legacy.id,workspace.id);
   }finally{
    await prisma.subscriptionPlan.update({where:{code:workspace.plan},data:{maxShops:oldPlan.maxShops,enabled:oldPlan.enabled}});
   }
  });
 }finally{
  stopTestServer(child);
  await prisma.$disconnect();
 }
});
