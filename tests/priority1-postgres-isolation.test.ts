import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';

const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('_test')||process.env.DATABASE_URL!==url)
 throw Error('Priority 1 tests MUST target the explicitly named disposable *_test database');
const {prisma}=await import('../modules/storage/client');
const {initialState}=await import('../modules/commerce/seed');
const {readWorkspace}=await import('../modules/storage/repository');
const {writeIsolatedCommerce}=await import('../modules/shops/aggregate-quotas');
const {mutateLegacyCommerce}=await import('../modules/shops/legacy-safe-writes');
const {createPublicCodOrder}=await import('../modules/shops/public-cod-checkout');
const {requireIsolatedOwner}=await import('../modules/shops/isolated-commerce');
const {requireShopPermission}=await import('../modules/shops/permissions');
const {performTeamAction}=await import('../modules/shops/team-actions');
const {normalizeState}=await import('../modules/commerce/normalize');

const seedId=randomUUID().slice(0,8);
const product=(id:string)=>({
 id,sku:id,name:'Article test',category:'Test',variant:'',price:20000,cost:4000,
 stock:2,threshold:1,color:'#ffffff',active:true
});
const blank=()=>initialState(false);
const importInput=(sku:string)=>({
 action:'importProducts',requestId:randomUUID(),
 payload:{rows:[{sku,name:'Imported',category:'Test',variant:'',price:10000,
  cost:5000,stock:0,threshold:1}]}
});
const totalOwned=async(ownerId:string,shopIds:string[])=>{
 const legacy=await prisma.workspace.findUniqueOrThrow({where:{ownerId},select:{data:true}});
 const shops=await prisma.shopCommerce.findMany({where:{shopId:{in:shopIds}},select:{data:true}});
 return normalizeState(legacy.data as never).products.length+
  shops.reduce((n,row)=>n+normalizeState(row.data as never).products.length,0);
};
const sumOrders=async(ownerId:string,shopIds:string[])=>{
 const legacy=await prisma.workspace.findUniqueOrThrow({where:{ownerId},select:{data:true}});
 const rows=await prisma.shopCommerce.findMany({where:{shopId:{in:shopIds}},select:{data:true}});
 return normalizeState(legacy.data as never).orders.length+
  rows.reduce((n,row)=>n+normalizeState(row.data as never).orders.length,0);
};

test('real Postgres: owners, tenants, same-owner serializability, quotas and stock',async t=>{
 let ownerId='',outsiderId='',agentId='',planCode='',orgId='';
 const shopIds:string[]=[];
 try{
  const owner=await prisma.user.create({data:{email:'p1-owner-'+seedId+'@example.test',
   name:'Owner',passwordHash:'test-only',role:'MERCHANT'}});
  const outsider=await prisma.user.create({data:{email:'p1-outsider-'+seedId+'@example.test',
   name:'Outsider',passwordHash:'test-only',role:'ADMIN'}});
  const agent=await prisma.user.create({data:{email:'p1-agent-'+seedId+'@example.test',
   name:'Agent',passwordHash:'test-only',role:'MERCHANT'}});
  ownerId=owner.id;outsiderId=outsider.id;agentId=agent.id;
  await readWorkspace(ownerId);
  planCode='P1-TEST-'+seedId.toUpperCase();
  await prisma.subscriptionPlan.create({data:{code:planCode,name:'P1 test',
   priceMillimes:0,durationDays:30,maxProducts:1,maxOrdersPerMonth:10,enabled:true}});
  await prisma.workspace.update({where:{ownerId},data:{
   data:blank() as unknown as Prisma.InputJsonValue,plan:planCode,
   subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)
  }});
  const org=await prisma.organization.create({data:{ownerId,name:'P1 tenant'}});orgId=org.id;
  for(let i=0;i<2;i++){
   const shop=await prisma.shop.create({data:{organizationId:orgId,name:'Shop '+i,
    slug:'p1-'+seedId+'-'+i,status:'PUBLISHED'}});
   shopIds.push(shop.id);
   await prisma.membership.create({data:{shopId:shop.id,userId:ownerId,role:'OWNER',active:true}});
   await prisma.shopCommerce.create({data:{shopId:shop.id,
    data:blank() as unknown as Prisma.InputJsonValue}});
  }
  await prisma.membership.create({data:{shopId:shopIds[0],userId:agentId,role:'CALL_CENTER',active:true}});

  await t.test('different owners and inactive employee cannot use secured owner endpoints',async()=>{
   await assert.rejects(requireIsolatedOwner(outsiderId,shopIds[0]),/introuvable/);
   await assert.rejects(requireShopPermission(outsiderId,shopIds[0],'orders.read'),/interdit/);
   await assert.rejects(writeIsolatedCommerce(outsiderId,shopIds[0],
    importInput('FORBIDDEN'),()=>{}),/introuvable|interdit/);
   const payload={action:'adjustStock' as const,requestId:randomUUID(),
    payload:{id:'p',quantity:1,reason:'Unjustified'}};
   await assert.rejects(performTeamAction(agentId,shopIds[0],payload),/interdit/);
   await prisma.membership.update({where:{shopId_userId:{shopId:shopIds[0],userId:agentId}},data:{active:false}});
   await assert.rejects(requireShopPermission(agentId,shopIds[0],'orders.read'),/interdit/);
  });

  await t.test('two shops compete for one plan product quota; only one succeeds',async()=>{
   const res=await Promise.allSettled([
    writeIsolatedCommerce(ownerId,shopIds[0],importInput('ONE'),()=>{}),
    writeIsolatedCommerce(ownerId,shopIds[1],importInput('TWO'),()=>{})
   ]);
   assert.equal(res.filter(r=>r.status==='fulfilled').length,1,JSON.stringify(res.map(r=>r.status)));
   assert.equal(await totalOwned(ownerId,shopIds),1);
   const failed=res.find(r=>r.status==='rejected') as PromiseRejectedResult;
   assert.match(String(failed.reason),/Plafond|Limite/);
  });

  await t.test('legacy vs isolated shop use one owner lock and one aggregate product quota',async()=>{
   for(const id of shopIds)await prisma.shopCommerce.update({where:{shopId:id},
    data:{data:blank() as unknown as Prisma.InputJsonValue}});
   const legacy=await prisma.workspace.findUniqueOrThrow({where:{ownerId}});
   await prisma.workspace.update({where:{ownerId},data:{
    data:blank() as unknown as Prisma.InputJsonValue,version:{increment:1}}});
   const a=mutateLegacyCommerce(ownerId,{action:'product',requestId:randomUUID(),
    payload:{sku:'LEGACY',name:'Legacy',category:'Test',variant:'',price:10000,
     cost:5000,stock:1,threshold:1,color:'#ddd'}});
   const b=writeIsolatedCommerce(ownerId,shopIds[1],importInput('NEW-SHOP'),()=>{});
   const results=await Promise.allSettled([a,b]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   assert.equal(await totalOwned(ownerId,shopIds),1);
   assert.match(String((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason),/Plafond|Limite/);
  });

  await t.test('parallel checkouts cannot oversell the same item and duplicate request retries are idempotent',async()=>{
   const legacy=blank();
   await prisma.workspace.update({where:{ownerId},data:{data:legacy as unknown as Prisma.InputJsonValue}});
   for(const id of shopIds){
    const state=blank();state.products=[{...product('p-'+id),stock:1}];
    await prisma.shopCommerce.update({where:{shopId:id},data:{data:state as unknown as Prisma.InputJsonValue}});
   }
   const slug=(await prisma.shop.findUniqueOrThrow({where:{id:shopIds[0]}})).slug;
   const item=(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:shopIds[0]}}));
   const itemId=normalizeState(item.data as never).products[0].id;
   const a={requestId:randomUUID(),name:'Client A',phone:'22123456',
    city:'Gabès' as const,address:'Rue A',items:[{productId:itemId,quantity:1}]};
   const b={...a,requestId:randomUUID(),phone:'55123456',name:'Client B'};
   const results=await Promise.allSettled([createPublicCodOrder(slug,a),createPublicCodOrder(slug,b)]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   const state=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:shopIds[0]}});
   const stored=normalizeState(state.data as never);
   assert.equal(stored.orders.length,1);
   assert.equal(stored.products[0].stock,0);
   const winner=results[0].status==='fulfilled'?a:b;
   const repeated=await createPublicCodOrder(slug,winner);
   assert.equal(repeated.alreadyApplied,true);
   assert.equal(await sumOrders(ownerId,shopIds),1);
  });

  await t.test('simultaneous checkout across two shops enforces aggregate monthly order quota',async()=>{
   await prisma.subscriptionPlan.update({where:{code:planCode},data:{maxProducts:10,maxOrdersPerMonth:1}});
   await prisma.workspace.update({where:{ownerId},data:{data:blank() as unknown as Prisma.InputJsonValue}});
   for(const id of shopIds){
    const state=blank();state.products=[product('p-'+id)];
    await prisma.shopCommerce.update({where:{shopId:id},data:{data:state as unknown as Prisma.InputJsonValue}});
   }
   const shops=await prisma.shop.findMany({where:{id:{in:shopIds}}});
   const order=(index:number)=>({
    requestId:randomUUID(),name:'Client test',phone:index===0?'22111111':'55111111',
    city:'Gabès' as const,address:'Rue à Gabès',items:[{productId:'p-'+shopIds[index],quantity:1}]
   });
   const res=await Promise.allSettled(
    shops.map(shop=>createPublicCodOrder(shop.slug,order(shopIds.indexOf(shop.id))))
   );
   assert.equal(res.filter(x=>x.status==='fulfilled').length,1);
   assert.equal(await sumOrders(ownerId,shopIds),1);
  });
 }finally{
  // Cleanup is isolated to the dedicated disposable test database.
  if(orgId)await prisma.organization.deleteMany({where:{id:orgId}});
  if(planCode)await prisma.subscriptionPlan.deleteMany({where:{code:planCode}});
  if(ownerId)await prisma.workspace.deleteMany({where:{ownerId}});
  if(agentId)await prisma.user.deleteMany({where:{id:agentId}});
  if(outsiderId)await prisma.user.deleteMany({where:{id:outsiderId}});
  if(ownerId)await prisma.user.deleteMany({where:{id:ownerId}});
  await prisma.$disconnect();
 }
});
