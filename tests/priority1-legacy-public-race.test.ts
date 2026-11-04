import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';

const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('_test')||url!==process.env.DATABASE_URL)
 throw Error('Legacy/public race suite requires explicitly disposable *_test PostgreSQL database');

const {prisma}=await import('../modules/storage/client');
const {initialState}=await import('../modules/commerce/seed');
const {normalizeState}=await import('../modules/commerce/normalize');
const {createLegacyPublicOrder}=await import('../modules/shops/legacy-public-checkout');
const {createPublicCodOrder}=await import('../modules/shops/public-cod-checkout');
const suffix=randomUUID().slice(0,8);

test('real PostgreSQL: legacy and isolated public checkouts share owner plan quota and lock',async()=>{
 let ownerId='',planCode='';
 try{
  const owner=await prisma.user.create({data:{email:'p1-public-'+suffix+'@example.test',
   name:'P1 Owner',passwordHash:'test-only'}});
  ownerId=owner.id;
  planCode='P1-PUBLIC-'+suffix.toUpperCase();
  await prisma.subscriptionPlan.create({data:{code:planCode,name:'Priority 1 public concurrency',
   durationDays:30,maxOrdersPerMonth:1,maxProducts:10,enabled:true}});
  const legacy=initialState(false);
  legacy.products=[{id:'legacy-p',sku:'LEG-P',name:'Legacy product',category:'Mode',
   variant:'',price:20000,cost:4000,stock:2,threshold:1,color:'#ffffff',active:true}];
  const legacySlug='p1-legacy-'+suffix;
  await prisma.workspace.create({data:{
   ownerId,slug:legacySlug,published:true,plan:planCode,subscriptionStatus:'ACTIVE',
   subscriptionEndsAt:new Date(Date.now()+86400000),
   data:legacy as unknown as Prisma.InputJsonValue
  }});
  const org=await prisma.organization.create({data:{ownerId,name:'P1 checkout owner'}});
  const modernSlug='p1-modern-'+suffix;
  const shop=await prisma.shop.create({data:{
   organizationId:org.id,slug:modernSlug,name:'Modern shop',status:'PUBLISHED'
  }});
  await prisma.membership.create({data:{shopId:shop.id,userId:ownerId,role:'OWNER'}});
  const modern=initialState(false);
  modern.products=[{id:'modern-p',sku:'MOD-P',name:'Modern product',category:'Mode',
   variant:'',price:15000,cost:3000,stock:2,threshold:1,color:'#ffffff',active:true}];
  await prisma.shopCommerce.create({data:{shopId:shop.id,
   data:modern as unknown as Prisma.InputJsonValue}});

  const oldInput={requestId:randomUUID(),
   customer:{name:'Faux client A',phone:'22123456',city:'Gabès',address:'Adresse test'},
   items:[{productId:'legacy-p',quantity:1}]};
  const newInput={requestId:randomUUID(),name:'Faux client B',phone:'55123456',
   city:'Gabès' as const,address:'Adresse test',items:[{productId:'modern-p',quantity:1}]};
  const results=await Promise.allSettled([
   createLegacyPublicOrder(legacySlug,oldInput),
   createPublicCodOrder(modernSlug,newInput)
  ]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1,
   'exactly one public checkout must pass the one-order global plan');
  const denied=results.find(x=>x.status==='rejected') as PromiseRejectedResult;
  assert.match(String(denied.reason),/Plafond|Limite/);
  const workspace=await prisma.workspace.findUniqueOrThrow({where:{ownerId}});
  const shopState=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:shop.id}});
  const old=normalizeState(workspace.data as never),current=normalizeState(shopState.data as never);
  assert.equal(old.orders.length+current.orders.length,1);
  assert.equal(old.products[0].stock+current.products[0].stock,3);
  assert.equal(await prisma.publicReceipt.count({where:{workspaceId:workspace.id}}),
   old.orders.length);
  if(results[0].status==='fulfilled'){
   const repeated=await createLegacyPublicOrder(legacySlug,oldInput);
   assert.deepEqual(repeated,results[0].value);
   assert.match(repeated.trackingUrl||'',/^\/suivi\/[a-f0-9]{64}$/);
  }else{
   const repeated=await createPublicCodOrder(modernSlug,newInput);
   assert.equal(repeated.alreadyApplied,true);
  }
  const after=await prisma.workspace.findUniqueOrThrow({where:{ownerId}});
  const afterShop=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:shop.id}});
  assert.equal(normalizeState(after.data as never).orders.length+
   normalizeState(afterShop.data as never).orders.length,1);
 }finally{
  // Only disposable CI database, not Neon.
  if(ownerId)await prisma.user.deleteMany({where:{id:ownerId}});
  if(planCode)await prisma.subscriptionPlan.deleteMany({where:{code:planCode}});
  await prisma.$disconnect();
 }
});
