import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {spawn,spawnSync,type ChildProcess} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {Prisma} from '@prisma/client';
import {initialState} from '../modules/commerce/seed';
import type {State} from '../modules/commerce/types';
import {portalSessionHash} from '../modules/auth/portal';
import {activityQuery,activityResponse} from '../modules/shops/activity-query';
import {stopTestServer} from './server-process';
const database=process.env.TEST_DATABASE_URL;
if(!database||database!==process.env.DATABASE_URL||!new URL(database).pathname.endsWith('_test'))throw Error('Activity tests require matching disposable *_test databases');
const {prisma}=await import('../modules/storage/client');
const {readActivity,rebuildActivity,verifyActivity,syncActivity}=await import('../modules/shops/activity-index-service');
const {writeIsolatedCommerce}=await import('../modules/shops/aggregate-quotas');
const {mutateLegacyCommerce}=await import('../modules/shops/legacy-safe-writes');
const {createPublicCodOrder}=await import('../modules/shops/public-cod-checkout');
const {createLegacyPublicOrder}=await import('../modules/shops/legacy-public-checkout');
const mark=randomBytes(4).toString('hex'),slug='activity-'+mark,plan='ACTIVITY_'+mark,origin='https://activity.example.test',base='http://127.0.0.1:3214';
let child:ChildProcess|undefined,ownerId='',otherId='',adminId='',orgId='',foreignOrg='',shopId='',legacyId='',foreignShop='',cookie='',otherCookie='',adminCookie='';
const asJson=(state:State)=>state as unknown as Prisma.InputJsonValue;
const query=(value={})=>activityQuery.parse(value);
const get=(path:string,session='')=>fetch(base+path,{headers:{cookie:session},redirect:'manual'});
const post=(path:string,body:unknown,session=cookie,from=origin)=>fetch(base+path,{method:'POST',headers:{cookie:session,origin:from,'content-type':'application/json'},body:JSON.stringify(body),redirect:'manual'});
const endpoint=()=>'/api/v1/shops/'+shopId+'/activity';
async function session(userId:string,admin=false){const token=randomBytes(32).toString('hex');await prisma.session.create({data:{userId,tokenHash:portalSessionHash(token,admin?'ADMIN':'MERCHANT'),expiresAt:new Date(Date.now()+3600000)}});return (admin?'__Host-tunicommerce-admin=':'__Host-tunicommerce=')+token;}
async function mutateData(change:(state:State)=>void){const row=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),next=row.data as unknown as State;change(next);return prisma.shopCommerce.update({where:{shopId},data:{data:asJson(next),version:{increment:1}}});}
test('Structured order and customer reads preserve source data, current commerce and tenant privacy',async t=>{
 try{
  await prisma.subscriptionPlan.create({data:{code:plan,name:'Disposable activity plan'}});
  const state=initialState(true),template=state.orders[0];state.demo=false;state.products.forEach(p=>p.stock=1000);
  state.customers=Array.from({length:83},(_,i)=>({id:'c'+i,name:i===1?'100%_Élise':i===2?'Nom\\Suite':i===3?'أمينة':'Élise '+i,phone:'22123456',city:'Tunis',address:'ADRESSE-PRIVEE-'+i,notes:'NOTE-PRIVEE-'+i}));
  state.orders=Array.from({length:83},(_,i)=>({...template,id:'o'+i,reference:'CMD-'+i,customerId:'c'+i,status:i%2?'DELIVERED':'TO_CONFIRM',total:1001+i,collected:i%2?1001+i:0,notes:'NOTE-COMMANDE-PRIVEE-'+i,...(i===0?{customerSnapshot:{...state.customers[0],name:'Nom figé à la commande'}}:{})}));
  const owner=await prisma.user.create({data:{email:slug+'@example.test',name:'Owner fixture',passwordHash:'unused-fixture',workspace:{create:{data:asJson(state),plan,slug:slug+'-legacy',published:true,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)}}},include:{workspace:true}});ownerId=owner.id;
  otherId=(await prisma.user.create({data:{email:slug+'-other@example.test',name:'Other fixture',passwordHash:'unused-fixture'}})).id;
  adminId=(await prisma.user.create({data:{email:slug+'-admin@example.test',name:'Admin fixture',role:'ADMIN',passwordHash:'unused-fixture'}})).id;
  orgId=(await prisma.organization.create({data:{ownerId,name:'Activity group'}})).id;foreignOrg=(await prisma.organization.create({data:{ownerId:otherId,name:'Foreign group'}})).id;
  shopId=(await prisma.shop.create({data:{organizationId:orgId,name:'Activité fictive',slug,status:'PUBLISHED',commerce:{create:{data:asJson(state)}},memberships:{create:[{userId:ownerId,role:'OWNER'},{userId:otherId,role:'OWNER'}]}}})).id;
  legacyId=(await prisma.shop.create({data:{organizationId:orgId,name:'Activité historique',slug:slug+'-linked',legacyWorkspaceId:owner.workspace!.id,memberships:{create:{userId:ownerId,role:'OWNER'}}}})).id;
  foreignShop=(await prisma.shop.create({data:{organizationId:foreignOrg,name:'Foreign fixture',slug:slug+'-foreign',commerce:{create:{data:asJson(state)}},memberships:{create:{userId:otherId,role:'OWNER'}}}})).id;
  cookie=await session(ownerId);otherCookie=await session(otherId);adminCookie=await session(adminId,true);
  child=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3214',APP_URL:origin,STOREFRONT_DOMAIN_ROUTING:'disabled'},stdio:'ignore'});
  let ready=false;for(let i=0;i<120;i++){try{if((await get('/api/health')).ok){ready=true;break;}}catch{}if(child.exitCode!==null)throw Error('Activity server exited');await pause(250);}assert.ok(ready);
  const cases=[{}, {q:'elise'},{q:'100%_'},{q:'_'},{q:'\\'},{q:'أمينة'},{q:'introuvable'},{status:'DELIVERED'},{page:3},{page:999},{pageSize:7,page:4},
   {view:'customers'},{view:'customers',q:'elise'},{view:'customers',q:'100%_'},{view:'customers',page:3},{view:'customers',q:'أمينة'}];
  const compatible:Awaited<ReturnType<typeof readActivity>>[]=[];
  await t.test('Anonymous, foreign-owner, employee and administrator sessions cannot read or prepare',async()=>{
   assert.equal((await get(endpoint())).status,401);assert.equal((await post(endpoint(),{action:'refresh'},'')).status,401);
   assert.equal((await get(endpoint(),otherCookie)).status,403);assert.equal((await get(endpoint(),adminCookie)).status,401);
   assert.equal((await post(endpoint(),{action:'refresh'},cookie,'https://evil.example')).status,403);
   for(const suffix of ['?pageSize=101','?view=customers&status=DELIVERED','?ownerId='+otherId])assert.equal((await get(endpoint()+suffix,cookie)).status,400);
   await prisma.membership.update({where:{shopId_userId:{shopId,userId:otherId}},data:{role:'VIEWER'}});assert.equal((await get(endpoint(),otherCookie)).status,403);
   assert.equal((await get('/mes-boutiques/'+shopId+'/activite',cookie)).status,200);assert.equal((await get('/mes-boutiques/'+shopId+'/activite',otherCookie)).status,404);
   assert.equal(await prisma.shopActivityIndex.count({where:{shopId}}),0);
  });
  await t.test('Compatibility reads are paginated and never return addresses, private notes or order payloads',async()=>{
   const r=await get(endpoint(),cookie);assert.match(r.headers.get('cache-control')||'',/no-store/);const value=activityResponse.parse(await r.json());assert.equal(value.total,83);assert.equal(value.orders.length,40);assert.equal(value.orders[0].customerName,'Nom figé à la commande');
   const text=JSON.stringify(value);for(const privateValue of ['ADRESSE-PRIVEE','NOTE-PRIVEE','NOTE-COMMANDE','"items"','"customerSnapshot"'])assert.equal(text.includes(privateValue),false);
   for(const value of cases)compatible.push(await readActivity(ownerId,shopId,query(value)));
  });
  await t.test('Concurrent backfill is serialized and does not change either commercial source',async()=>{
   const before=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),workspace=await prisma.workspace.findUniqueOrThrow({where:{ownerId}});
   const results=await Promise.all([post(endpoint(),{action:'refresh'}),post(endpoint(),{action:'refresh'})]);assert.ok(results.every(r=>r.status===200));const values=await Promise.all(results.map(r=>r.json()));assert.deepEqual(values.map(v=>v.unchanged).sort(),[false,true]);
   assert.deepEqual(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),before);assert.deepEqual(await prisma.workspace.findUniqueOrThrow({where:{ownerId}}),workspace);assert.equal((await verifyActivity(ownerId,shopId)).matches,true);assert.equal(await prisma.shopActivityIndex.count({where:{shopId:foreignShop}}),0);
  });
  await t.test('Relational reads match every compatible search, status and page including literal SQL wildcard characters',async()=>{
   for(let i=0;i<cases.length;i++){const result=await readActivity(ownerId,shopId,query(cases[i]));assert.equal(result.source,'relational');assert.deepEqual({...result,source:'compatible'},compatible[i],JSON.stringify(cases[i]));}
  });
  await t.test('Merchant edits and replay keep notes, statuses and derived customer counts in parity',async()=>{
   const request={action:'note',payload:{id:'o0',note:'Local note fixture'},requestId:randomUUID()};await writeIsolatedCommerce(ownerId,shopId,request,()=>{});await writeIsolatedCommerce(ownerId,shopId,request,()=>{});
   await writeIsolatedCommerce(ownerId,shopId,{action:'transition',payload:{id:'o0',status:'CONFIRMED'},requestId:randomUUID()},()=>{});
   assert.equal((await readActivity(ownerId,shopId,query({q:'CMD-0'}))).orders[0].status,'CONFIRMED');assert.equal((await verifyActivity(ownerId,shopId)).matches,true);
  });
  await t.test('Old writers invalidate the projection for order or customer changes, but not catalog-only changes or forced versions',async()=>{
   const previous=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}});
   const changed=await mutateData(s=>{s.orders[1].reference='CMD-UPDATED';s.customers[1].name='Nouveau client';});assert.equal(changed.activityVersion,previous.activityVersion+1);
   assert.equal((await readActivity(ownerId,shopId,query({q:'CMD-UPDATED'}))).source,'compatible');assert.equal((await readActivity(ownerId,shopId,query({view:'customers',q:'Nouveau client'}))).total,1);
   await rebuildActivity(ownerId,shopId);const current=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),next=current.data as unknown as State;next.products[0].stock++;
   const forced=await prisma.shopCommerce.update({where:{shopId},data:{data:asJson(next),activityVersion:123456}});assert.equal(forced.activityVersion,current.activityVersion);assert.equal((await readActivity(ownerId,shopId,query())).source,'relational');
  });
  await t.test('Both public checkouts and legacy merchant writes maintain the same prepared read models without duplicate orders',async()=>{
   await rebuildActivity(ownerId,legacyId);
   const request={requestId:randomUUID(),name:'Client checkout fictif',phone:'22123456',city:'Tunis' as const,address:'Adresse fictive locale',items:[{productId:'p1',quantity:1}]};
   const before=(await readActivity(ownerId,shopId,query())).total;await createPublicCodOrder(slug,request);await createPublicCodOrder(slug,request);assert.equal((await readActivity(ownerId,shopId,query())).total,before+1);
   const legacy={requestId:randomUUID(),customer:{name:request.name,phone:request.phone,city:request.city,address:request.address},items:request.items};await createLegacyPublicOrder(slug+'-legacy',legacy);await createLegacyPublicOrder(slug+'-legacy',legacy);
   await mutateLegacyCommerce(ownerId,{action:'note',payload:{id:'o0',note:'Legacy note fixture'},requestId:randomUUID()});
   assert.equal((await verifyActivity(ownerId,legacyId)).matches,true);assert.equal((await verifyActivity(ownerId,shopId)).matches,true);assert.equal((await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:foreignShop}})).activityVersion,0);
  });
  await t.test('A transaction rollback rolls source and projection back together',async()=>{
   const before=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}});
   await assert.rejects(prisma.$transaction(async tx=>{const next=structuredClone(before.data) as unknown as State;next.orders[0].reference='ROLLBACK';await tx.shopCommerce.update({where:{shopId},data:{data:asJson(next),version:{increment:1}}});await syncActivity(tx,{shopId},before.data as unknown as State,next,before.activityVersion);throw Error('Intentional disposable rollback');}),/Intentional disposable rollback/);
   assert.deepEqual(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),before);assert.equal((await verifyActivity(ownerId,shopId)).matches,true);
  });
  await t.test('Aggregate parity catches corrupted derived fields and repairs only disposable rows',async()=>{
   const before=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}});await prisma.shopActivityCustomer.update({where:{shopId_customerId:{shopId,customerId:'c1'}},data:{orderCount:999}});assert.equal((await verifyActivity(ownerId,shopId)).matches,false);
   const cli=(apply=false)=>spawnSync(process.execPath,['--import','tsx','scripts/activity-index.ts','--shop-id='+shopId,...(apply?['--apply']:[])],{encoding:'utf8',env:process.env,windowsHide:true});
   const preview=cli();assert.equal(preview.status,1);const diagnosis=JSON.parse(preview.stdout);assert.equal(diagnosis.matches,false);assert.equal(diagnosis.mismatchedCustomers,1);assert.equal(preview.stdout.includes('Client'),false);
   const repair=cli(true);assert.equal(repair.status,0,repair.stderr);assert.equal(JSON.parse(repair.stdout).matches,true);
   assert.equal((await verifyActivity(ownerId,shopId)).matches,true);assert.deepEqual(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),before);
  });
  await t.test('Invalid historical preparation rolls back without changing merchant data and membership revocation closes access',async()=>{
   await mutateData(s=>{s.orders[0].total=0.5;});const before=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}});assert.equal((await post(endpoint(),{action:'refresh'})).status,409);assert.deepEqual(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),before);
   await prisma.membership.update({where:{shopId_userId:{shopId,userId:ownerId}},data:{active:false}});assert.equal((await get(endpoint(),cookie)).status,404);assert.equal((await get('/mes-boutiques/'+shopId+'/activite',cookie)).status,404);
  });
 }finally{await stopTestServer(child);await prisma.organization.deleteMany({where:{id:{in:[orgId,foreignOrg].filter(Boolean)}}});await prisma.user.deleteMany({where:{id:{in:[ownerId,otherId,adminId].filter(Boolean)}}});await prisma.subscriptionPlan.deleteMany({where:{code:plan}});await prisma.$disconnect();}
});
