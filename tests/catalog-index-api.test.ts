import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {Prisma} from '@prisma/client';
import {stopTestServer} from './server-process';
import {initialState} from '../modules/commerce/seed';
import type {State} from '../modules/commerce/types';
import {catalogQuery} from '../modules/shops/catalog-query';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)throw Error('Catalog tests require matching disposable *_test PostgreSQL databases');
const {prisma}=await import('../modules/storage/client');
const {hashPassword}=await import('../modules/auth/crypto');
const {readCatalog,rebuildCatalog,verifyCatalog}=await import('../modules/shops/catalog-index-service');
const {writeIsolatedCommerce}=await import('../modules/shops/aggregate-quotas');
const {mutateLegacyCommerce}=await import('../modules/shops/legacy-safe-writes');
const {createPublicCodOrder}=await import('../modules/shops/public-cod-checkout');
const {createLegacyPublicOrder}=await import('../modules/shops/legacy-public-checkout');
const mark=randomUUID().slice(0,8),slug='catalog-'+mark,plan='CATALOG_'+mark;
const origin='https://catalog.example.test',base='http://127.0.0.1:3208',password='Catalog-Fixture-2026!';
let server:ChildProcess|undefined,ownerId='',otherId='',org='',otherOrg='',shopId='',otherShop='',legacyShop='',workspaceId='',cookie='',otherCookie='';
const get=(path:string,session='')=>fetch(base+path,{headers:{cookie:session},redirect:'manual'});
const post=(path:string,body:unknown,session=cookie,from=origin)=>fetch(base+path,{method:'POST',headers:{cookie:session,origin:from,'content-type':'application/json'},body:JSON.stringify(body),redirect:'manual'});
const endpoint=()=>'/api/v1/shops/'+shopId+'/catalog';
const query=(q={})=>catalogQuery.parse(q);
const stock=(id:string,quantity:number,requestId=randomUUID())=>writeIsolatedCommerce(ownerId,shopId,{action:'stock',payload:{id,quantity,reason:'Fixture stock'},requestId},()=>{});

test('Relational catalog transition preserves tenant scope, source parity and current stock',async t=>{
 try{
  await prisma.subscriptionPlan.create({data:{code:plan,name:'Catalog fixture'}});
  const state=initialState(false);
  state.products=Array.from({length:83},(_,i)=>({id:'p'+i,name:i===1?'100%_édition':i===2?'Back\\slash':i===3?'قميص':'Édition '+i,
   sku:'CAT-'+i,category:'Mode',variant:'Sable',price:1001+i,cost:500,stock:i===4?0:20,threshold:2,color:'#abcdef',active:i%5!==0,
   description:'Description '+i,...(i===1?{quantityOffers:[{quantity:2,price:900,label:'Duo'}]}:{})}));
  state.products[0].active=true;
  const data=state as unknown as Prisma.InputJsonValue,passwordHash=await hashPassword(password);
  const owner=await prisma.user.create({data:{email:slug+'@example.test',name:'Catalog owner',passwordHash,workspace:{create:{plan,data,published:true,slug:slug+'-legacy',subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)}}},include:{workspace:true}});
  ownerId=owner.id;workspaceId=owner.workspace!.id;
  otherId=(await prisma.user.create({data:{email:slug+'-other@example.test',name:'Other owner',passwordHash}})).id;
  org=(await prisma.organization.create({data:{ownerId,name:'Catalog org'}})).id;
  otherOrg=(await prisma.organization.create({data:{ownerId:otherId,name:'Other catalog org'}})).id;
  shopId=(await prisma.shop.create({data:{organizationId:org,name:'Catalogue fictif',slug,status:'PUBLISHED',commerce:{create:{data}},memberships:{create:{userId:ownerId,role:'OWNER'}}}})).id;
  legacyShop=(await prisma.shop.create({data:{organizationId:org,name:'Catalogue historique',slug:slug+'-linked',legacyWorkspaceId:workspaceId,memberships:{create:{userId:ownerId,role:'OWNER'}}}})).id;
  otherShop=(await prisma.shop.create({data:{organizationId:otherOrg,name:'Autre catalogue',slug:slug+'-other',commerce:{create:{data}},memberships:{create:{userId:otherId,role:'OWNER'}}}})).id;
  await prisma.membership.create({data:{shopId,userId:otherId,role:'OWNER'}});
  server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3208',APP_URL:origin},stdio:'ignore'});
  let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('App exited');try{if((await get('/api/health')).ok){ready=true;break;}}catch{}await pause(250);}assert.ok(ready);
  for(const [email,own] of [[owner.email,true],[slug+'-other@example.test',false]] as const){
   const login=await post('/api/auth/merchant/login',{email,password},'');assert.equal(login.status,200);
   const session=login.headers.get('set-cookie')!.split(';')[0];if(own)cookie=session;else otherCookie=session;
  }
  const cases=[{}, {q:'edition'},{q:'100%_'},{q:'_'},{q:'\\'},{q:'قميص'},{status:'inactive'},{stock:'out'},
   {stock:'low'},{status:'inactive',stock:'low'},{q:'introuvable'},{page:3},{page:999},{pageSize:7,page:4}];
  const compatible:Awaited<ReturnType<typeof readCatalog>>[]=[];
  await t.test('Private reads are bounded, owner-authorized and do not provision an index',async()=>{
   assert.equal((await get(endpoint())).status,401);assert.equal((await post(endpoint(),{action:'refresh'},'')).status,401);
   assert.equal((await get(endpoint(),otherCookie)).status,403);
   assert.equal((await post(endpoint(),{action:'refresh'},cookie,'https://evil.example')).status,403);
   for(const suffix of ['?pageSize=101','?page=0','?ownerId='+otherId])assert.equal((await get(endpoint()+suffix,cookie)).status,400);
   const page=await get('/mes-boutiques/'+shopId+'/catalogue',cookie);assert.equal(page.status,200);
   assert.equal((await get('/mes-boutiques/'+shopId+'/catalogue',otherCookie)).status,404);
   const first=await get(endpoint(),cookie);assert.ok(first.headers.get('cache-control')?.includes('no-store'));
   const result=await first.json();assert.equal(result.products.length,40);assert.equal(result.total,83);assert.equal(result.source,'compatible');
   for(const value of cases)compatible.push(await readCatalog(ownerId,shopId,query(value)));
   assert.equal(await prisma.shopCatalogIndex.count({where:{shopId}}),0);
  });
  await t.test('Concurrent preparation preserves both JSON state and commerce version',async()=>{
   const before=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}});
   const responses=await Promise.all([post(endpoint(),{action:'refresh'}),post(endpoint(),{action:'refresh'})]);
   assert.ok(responses.every(r=>r.status===200));
   const outcomes=await Promise.all(responses.map(r=>r.json()));assert.deepEqual(outcomes.map(r=>r.unchanged).sort(),[false,true]);
   const after=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}});
   assert.deepEqual(after,before);assert.equal(await prisma.shopCatalogProduct.count({where:{shopId}}),83);
   assert.equal((await verifyCatalog(ownerId,shopId)).matches,true);
   assert.equal(await prisma.shopCatalogProduct.count({where:{shopId:otherShop}}),0);
  });
  await t.test('SQL and compatibility reads return exactly the same pages and literal search results',async()=>{
   for(let i=0;i<cases.length;i++){
    const result=await readCatalog(ownerId,shopId,query(cases[i]));assert.equal(result.source,'relational');
    const expected=compatible[i];assert.deepEqual({...result,source:expected.source},expected,'Parity '+JSON.stringify(cases[i]));
   }
  });
  await t.test('Stock writes and retries keep the ready index in the same transaction',async()=>{
   const id=randomUUID();await stock('p0',-3,id);await stock('p0',-3,id);
   const result=await readCatalog(ownerId,shopId,query({q:'CAT-0'}));assert.equal(result.source,'relational');assert.equal(result.products[0].stock,17);
   assert.equal((await verifyCatalog(ownerId,shopId)).matches,true);
   await assert.rejects(stock('p0',-1000));assert.equal((await verifyCatalog(ownerId,shopId)).matches,true);
   const before=await prisma.shopCatalogProduct.findUniqueOrThrow({where:{shopId_productId:{shopId,productId:'p0'}}});
   await assert.rejects(prisma.$transaction(async tx=>{await tx.shopCatalogProduct.update({where:{shopId_productId:{shopId,productId:'p0'}},data:{stock:BigInt(999)}});throw Error('rollback');}));
   assert.deepEqual(await prisma.shopCatalogProduct.findUniqueOrThrow({where:{shopId_productId:{shopId,productId:'p0'}}}),before);
  });
  await t.test('A writer outside the projection path invalidates its version instead of serving stale stock',async()=>{
   const row=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),next=row.data as unknown as State;
   next.products[0].stock=7;
   const changed=await prisma.shopCommerce.update({where:{shopId},data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}});
   assert.equal(changed.catalogVersion,row.catalogVersion+1);
   const result=await readCatalog(ownerId,shopId,query({q:'CAT-0'}));assert.equal(result.source,'compatible');assert.equal(result.products[0].stock,7);
   assert.equal((await verifyCatalog(ownerId,shopId)).matches,false);
   await rebuildCatalog(ownerId,shopId);assert.equal((await verifyCatalog(ownerId,shopId)).matches,true);
   next.audit.unshift({id:randomUUID(),at:new Date().toISOString(),label:'Non-catalog change'});
   const note=await prisma.shopCommerce.update({where:{shopId},data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1},catalogVersion:123456}});
   assert.equal(note.catalogVersion,changed.catalogVersion,'Only product changes can advance the version');
   assert.equal((await readCatalog(ownerId,shopId,query())).source,'relational');
  });
  await t.test('Both public checkouts and legacy merchant writes maintain isolated current stock',async()=>{
   await rebuildCatalog(ownerId,legacyShop);
   const request={requestId:randomUUID(),name:'Client fictif',phone:'22123456',city:'Tunis' as const,address:'Adresse fictive',items:[{productId:'p0',quantity:1}]};
   await createPublicCodOrder(slug,request);await createPublicCodOrder(slug,request);
   assert.equal((await readCatalog(ownerId,shopId,query({q:'CAT-0'}))).products[0].stock,6);
   const legacy={requestId:randomUUID(),customer:{name:request.name,phone:request.phone,city:request.city,address:request.address},items:request.items};
   await createLegacyPublicOrder(slug+'-legacy',legacy);await createLegacyPublicOrder(slug+'-legacy',legacy);
   await mutateLegacyCommerce(ownerId,{action:'stock',payload:{id:'p0',quantity:2,reason:'Legacy fixture'},requestId:randomUUID()});
   assert.equal((await readCatalog(ownerId,legacyShop,query({q:'CAT-0'}))).products[0].stock,21);
   assert.equal((await verifyCatalog(ownerId,legacyShop)).matches,true);assert.equal((await verifyCatalog(ownerId,shopId)).matches,true);
   assert.equal((await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:otherShop}})).catalogVersion,0);
  });
  await t.test('Read-only parity detects a corrupted index and explicit rebuilding repairs only the index',async()=>{
   const before=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}});
   await prisma.shopCatalogProduct.update({where:{shopId_productId:{shopId,productId:'p0'}},data:{stock:BigInt(999)}});
   assert.equal((await verifyCatalog(ownerId,shopId)).matches,false);
   await rebuildCatalog(ownerId,shopId,true);assert.equal((await verifyCatalog(ownerId,shopId)).matches,true);
   assert.deepEqual(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),before);
  });
  await t.test('Invalid historical values fail preparation without rewriting or blocking valid commerce writes',async()=>{
   const row=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),next=row.data as unknown as State;
   next.products[2].price=0.5;
   await prisma.shopCommerce.update({where:{shopId},data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}});
   const before=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}});
   assert.equal((await post(endpoint(),{action:'refresh'})).status,409);
   assert.deepEqual(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),before);
   await stock('p0',1);assert.equal((await readCatalog(ownerId,shopId,query())).source,'compatible');
   const repaired=(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}})).data as unknown as State;repaired.products[2].price=1003;
   await prisma.shopCommerce.update({where:{shopId},data:{data:repaired as unknown as Prisma.InputJsonValue,version:{increment:1}}});
   await rebuildCatalog(ownerId,shopId,true);assert.equal((await verifyCatalog(ownerId,shopId)).matches,true);
  });
 }finally{
  if(server&&server.exitCode===null){const exited=once(server,'exit');stopTestServer(server);await exited;}
  await prisma.organization.deleteMany({where:{id:{in:[org,otherOrg].filter(Boolean)}}});
  await prisma.user.deleteMany({where:{id:{in:[ownerId,otherId].filter(Boolean)}}});
  await prisma.subscriptionPlan.deleteMany({where:{code:plan}});
  await prisma.$disconnect();
 }
});
