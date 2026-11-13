import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {request} from 'node:http';
import {setTimeout as pause} from 'node:timers/promises';
import {initialState} from '../modules/commerce/seed';
import {portalSessionHash} from '../modules/auth/portal';
import {stopTestServer} from './server-process';
import {proofPrefix} from '../modules/shops/domains-validation';
import {domainOverviewResponse} from '../modules/shops/domain-overview';
const database=process.env.TEST_DATABASE_URL;
if(!database||database!==process.env.DATABASE_URL||!new URL(database).pathname.endsWith('_test'))throw Error('Domain checks require matching disposable *_test databases');
const platform='platform.example.test',origin='https://'+platform,base='http://127.0.0.1:3213',mark=randomBytes(4).toString('hex');
process.env.APP_URL=origin;process.env.STOREFRONT_DOMAIN_ROUTING='enabled';process.env.STOREFRONT_ROOT_DOMAIN='shops.example';
const {prisma}=await import('../modules/storage/client');
const {domainOverview,changeShopDomain}=await import('../modules/shops/domains-service');
const {resolveStorefrontHost}=await import('../modules/shops/domains-routing');
const {revalidateDomainBindings}=await import('../modules/shops/domain-revalidation');
const goodLookup=async(name:string)=>{const row=await prisma.shopDomainClaim.findFirst({where:{hostname:name.slice(proofPrefix.length)}});return row?[['tunicom=',row.token]]:[];};
const hostFetch=(path:string,host=platform,cookie='',body?:unknown)=>new Promise<Response>((resolve,reject)=>{
 const req=request(base+path,{method:body?'POST':'GET',headers:{host,cookie,...(body?{origin,'content-type':'application/json'}:{})}},response=>{
  const chunks:Buffer[]=[];response.on('data',chunk=>chunks.push(Buffer.from(chunk)));response.on('end',()=>{const headers=new Headers();for(const [key,value] of Object.entries(response.headers))if(Array.isArray(value))for(const item of value)headers.append(key,item);else if(value!==undefined)headers.set(key,value);resolve(new Response(Buffer.concat(chunks),{status:response.statusCode,headers}));});
 });req.on('error',reject);req.setTimeout(10000,()=>req.destroy(Error('HTTP fixture timeout')));req.end(body?JSON.stringify(body):undefined);
});
let child:ChildProcess|undefined,ownerId='',otherId='',orgId='',shopId='',cookie='',otherCookie='',claimId='';
const custom='proof-'+mark+'.example',slug='proof-'+mark;
async function session(userId:string){const token=randomBytes(32).toString('hex');await prisma.session.create({data:{userId,tokenHash:portalSessionHash(token,'MERCHANT'),expiresAt:new Date(Date.now()+3600000)}});return '__Host-tunicommerce='+token;}
async function due(hostname=custom){await prisma.shopDomainBinding.update({where:{hostname},data:{nextCheckAt:new Date(0),checkLeaseId:null,checkLockedUntil:null}});}
async function addVerified(target:string,hostname:string){await changeShopDomain(ownerId,target,{action:'add',hostname});const row=await prisma.shopDomainClaim.findUniqueOrThrow({where:{shopId_hostname:{shopId:target,hostname}}});await changeShopDomain(ownerId,target,{action:'verify',id:row.id},goodLookup);return row;}

test('Personal domain revalidation: freshness, DNS failure, leases and ownership boundaries',async t=>{
 try{
  // The scheduler is global; this disposable suite owns its proof queue.
  await prisma.shopDomainClaim.deleteMany();
  const data=initialState(false);data.shop.name='Recette domaines';data.products=initialState(true).products.slice(0,1).map(p=>({...p,imageUrl:''}));
  const owner=await prisma.user.create({data:{email:'proof-'+mark+'@example.test',name:'Proof owner fixture',passwordHash:'unused-fixture',workspace:{create:{data:initialState(false) as never,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+30*86400000)}}}});ownerId=owner.id;
  otherId=(await prisma.user.create({data:{email:'proof-other-'+mark+'@example.test',name:'New owner fixture',passwordHash:'unused-fixture',workspace:{create:{data:initialState(false) as never,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+30*86400000)}}}})).id;
  orgId=(await prisma.organization.create({data:{ownerId,name:'Proof fixture group'}})).id;
  shopId=(await prisma.shop.create({data:{organizationId:orgId,name:data.shop.name,slug,status:'PUBLISHED',commerce:{create:{data:data as never}},memberships:{create:[{userId:ownerId,role:'OWNER'},{userId:otherId,role:'OWNER'}]}}})).id;
  cookie=await session(ownerId);otherCookie=await session(otherId);const claim=await addVerified(shopId,custom);claimId=claim.id;
  child=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3213'},stdio:'ignore'});
  let ready=false;for(let i=0;i<120;i++){try{if((await hostFetch('/api/health')).ok){ready=true;break;}}catch{}if(child.exitCode!==null)throw Error('Domain fixture server exited');await pause(250);}assert.ok(ready);
  await t.test('Fresh proof grants only the shop public host and owner diagnostics omit internal leases',async()=>{
   assert.equal((await hostFetch('/',custom)).status,200);assert.equal((await hostFetch('/admin',custom,cookie)).status,404);
   assert.equal((await hostFetch('/api/v1/public/domains/allow?domain='+custom)).status,200);
   const response=await hostFetch('/api/v1/shops/'+shopId+'/domains',platform,cookie);assert.equal(response.status,200);
   const view=domainOverviewResponse.parse(await response.json());assert.equal(view.claims[0].health,'VERIFIED');assert.equal(view.claims[0].requiresNewProof,false);
   assert.equal('checkLeaseId' in view.claims[0],false);assert.equal('ownerId' in view.claims[0],false);
   assert.equal((await hostFetch('/api/v1/shops/'+shopId+'/domains',platform,otherCookie)).status,403);
  });
  await t.test('Stale personal proof is denied by the HTTP host and certificate gate while automatic subdomains remain independent',async()=>{
   await prisma.shopDomainBinding.update({where:{hostname:custom},data:{verifiedAt:new Date(Date.now()-73*3600000)}});
   assert.equal(await resolveStorefrontHost(custom),null);assert.equal((await hostFetch('/',custom)).status,404);
   assert.equal((await hostFetch('/api/v1/public/domains/allow?domain='+custom)).status,403);
   assert.ok(await resolveStorefrontHost(slug+'.shops.example'));await due();
   const result=await revalidateDomainBindings(goodLookup);assert.ok(result.verified>=1);assert.equal((await hostFetch('/',custom)).status,200);
  });
  await t.test('Legacy-shaped inserts acquire one owner snapshot without requiring the new client fields',async()=>{
   const id=randomUUID(),hostname='legacy-shape-'+mark+'.example',token=randomBytes(32).toString('hex');
   try{
    await prisma.$executeRaw`INSERT INTO "ShopDomainClaim" ("id","shopId","hostname","token","expiresAt","createdAt","updatedAt")
     VALUES (${id},${shopId},${hostname},${token},${new Date(Date.now()+86400000)},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`;
    await prisma.$executeRaw`INSERT INTO "ShopDomainBinding" ("hostname","shopId","claimId","verifiedAt") VALUES (${hostname},${shopId},${id},CURRENT_TIMESTAMP)`;
    assert.equal((await prisma.shopDomainClaim.findUniqueOrThrow({where:{id}})).ownerId,ownerId);
    assert.equal((await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname}})).ownerId,ownerId);
   }finally{await prisma.shopDomainClaim.deleteMany({where:{id}});}
  });
  await t.test('Transient DNS failure keeps a recent proof but never extends its expiry',async()=>{
   const recent=new Date(Date.now()-25*3600000);await prisma.shopDomainBinding.update({where:{hostname:custom},data:{verifiedAt:recent}});await due();
   const result=await revalidateDomainBindings(async()=>{throw Object.assign(Error('simulated DNS outage'),{code:'ETIMEOUT'});});assert.ok(result.unavailable>=1);
   let row=await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}});assert.deepEqual(row.verifiedAt,recent);assert.equal(row.lastError,'DNS_UNAVAILABLE');assert.ok(await resolveStorefrontHost(custom));
   await prisma.shopDomainBinding.update({where:{hostname:custom},data:{verifiedAt:new Date(Date.now()-73*3600000)}});await due();
   await revalidateDomainBindings(async()=>{throw Error('simulated DNS outage');});assert.equal(await resolveStorefrontHost(custom),null);
   await due();await revalidateDomainBindings(goodLookup);row=await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}});assert.equal(row.lastError,null);
  });
  await t.test('Missing TXT revokes routing and a later matching proof restores it',async()=>{
   await due();await revalidateDomainBindings(async()=>[]);let row=await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}});
   assert.equal(row.proofStatus,'REVOKED');assert.equal((await hostFetch('/',custom)).status,404);assert.equal((await domainOverview(ownerId,shopId)).claims[0].health,'REVOKED');
   await due();await revalidateDomainBindings(goodLookup);row=await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}});assert.equal(row.proofStatus,'VERIFIED');assert.equal((await hostFetch('/',custom)).status,200);
  });
  await t.test('Concurrent workers lease at most five bindings each and never duplicate a lookup',async()=>{
   const second=(await prisma.shop.create({data:{organizationId:orgId,name:'Second fixture',slug:slug+'-second',status:'PUBLISHED',commerce:{create:{data:data as never}},memberships:{create:{userId:ownerId,role:'OWNER'}}}})).id;
   const names=[];for(let i=0;i<6;i++){const hostname='batch-'+mark+'-'+i+'.example';await addVerified(i<4?shopId:second,hostname);await due(hostname);names.push(hostname);}
   const counts=new Map<string,number>();const lookup=async(name:string)=>{counts.set(name,(counts.get(name)||0)+1);await pause(10);return goodLookup(name);};
   const results=await Promise.all([revalidateDomainBindings(lookup),revalidateDomainBindings(lookup)]);assert.ok(results.every(row=>row.scanned<=5));
   for(const name of names)assert.equal(counts.get(proofPrefix+name),1);assert.equal(results.reduce((n,row)=>n+row.verified,0)>=6,true);
  });
  await t.test('A late negative result cannot overwrite a manual verification, and an expired lease cannot commit',async()=>{
   await due();let entered!:()=>void,release!:()=>void;const start=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
   const running=revalidateDomainBindings(async()=>{entered();await gate;return [];});await start;
   try{await changeShopDomain(ownerId,shopId,{action:'verify',id:claimId},goodLookup);}finally{release();}
   assert.ok((await running).superseded>=1);assert.equal((await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}})).proofStatus,'VERIFIED');
   await due();let legacyEntered!:()=>void,legacyRelease!:()=>void;const legacyStart=new Promise<void>(resolve=>{legacyEntered=resolve;}),legacyGate=new Promise<void>(resolve=>{legacyRelease=resolve;});
   const legacyRunning=revalidateDomainBindings(async()=>{legacyEntered();await legacyGate;return [];});await legacyStart;
   const refreshedAt=new Date(Date.now()+1000);try{await prisma.shopDomainBinding.update({where:{hostname:custom},data:{verifiedAt:refreshedAt}});}finally{legacyRelease();}
   assert.ok((await legacyRunning).superseded>=1);assert.deepEqual((await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}})).verifiedAt,refreshedAt);
   await due();const before=await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}});
   const expired=await revalidateDomainBindings(async name=>{await prisma.shopDomainBinding.update({where:{hostname:custom},data:{checkLockedUntil:new Date(0)}});return goodLookup(name);});
   assert.ok(expired.superseded>=1);assert.deepEqual((await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}})).verifiedAt,before.verifiedAt);
  });
  await t.test('Ownership transfer rejects the old proof and requires a fresh token controlled by the new owner',async()=>{
   const old=await prisma.shopDomainClaim.findUniqueOrThrow({where:{id:claimId}});await prisma.organization.update({where:{id:orgId},data:{ownerId:otherId}});await due();
   let calls=0;await revalidateDomainBindings(async()=>{calls++;return [['tunicom='+old.token]];});assert.equal(calls,0);
   assert.equal((await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}})).proofStatus,'OWNER_CHANGED');assert.equal(await resolveStorefrontHost(custom),null);
   let view=await domainOverview(otherId,shopId);const displayed=view.claims.find(item=>item.id===claimId)!;assert.equal(displayed.requiresNewProof,true);assert.equal(displayed.recordValue,'');
   const html=await (await hostFetch('/mes-boutiques/'+shopId+'/domaines',platform,otherCookie)).text();assert.ok(html.includes('nouveau code TXT'));assert.equal(html.includes(old.token),false);
   await assert.rejects(changeShopDomain(otherId,shopId,{action:'verify',id:claimId},goodLookup),{status:409});
   const renewed=await hostFetch('/api/v1/shops/'+shopId+'/domains',platform,otherCookie,{action:'renew',id:claimId});assert.equal(renewed.status,200);
   const fresh=await prisma.shopDomainClaim.findUniqueOrThrow({where:{id:claimId}});assert.notEqual(fresh.token,old.token);assert.equal(fresh.ownerId,otherId);
   await assert.rejects(changeShopDomain(otherId,shopId,{action:'verify',id:claimId},async()=>[['tunicom='+old.token]]),{status:409});
   await changeShopDomain(otherId,shopId,{action:'verify',id:claimId},goodLookup);assert.ok(await resolveStorefrontHost(custom));
   view=await domainOverview(otherId,shopId);assert.equal(view.claims.find(item=>item.id===claimId)!.health,'VERIFIED');
   assert.equal((await hostFetch('/api/v1/shops/'+shopId+'/domains',platform,cookie)).status,403);
  });
  await t.test('Disabled routing performs no DNS lookup or lease mutation',async()=>{
   process.env.STOREFRONT_DOMAIN_ROUTING='disabled';await due();let calls=0;
   const result=await revalidateDomainBindings(async()=>{calls++;return [];});assert.equal(result.enabled,false);assert.equal(calls,0);
   assert.equal((await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}})).checkLeaseId,null);process.env.STOREFRONT_DOMAIN_ROUTING='enabled';
  });
 }finally{
  if(child)await stopTestServer(child);if(orgId)await prisma.organization.deleteMany({where:{id:orgId}});
  await prisma.user.deleteMany({where:{id:{in:[ownerId,otherId].filter(Boolean)}}});await prisma.$disconnect();
 }
});
