import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import type {State} from '../modules/commerce/types';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)
 throw Error('Order compaction requires matching disposable *_test PostgreSQL databases');
const {prisma}=await import('../modules/storage/client');
const {writeIsolatedCommerce}=await import('../modules/shops/aggregate-quotas');
const {rebuildActivity,verifyActivity}=await import('../modules/shops/activity-index-service');
const {offloadAllHistories,historyCsv}=await import('../modules/commerce/history');
const {COMPACTION_BATCH}=await import('../modules/commerce/compaction');
const mark=randomUUID().slice(0,8);
const shift=(iso:string,days:number)=>new Date(Date.parse(iso)-days*86400000).toISOString();

test('a real merchant write compacts old orders, archives their history and keeps the search copy in parity',async()=>{
 const owner=await prisma.user.create({data:{email:'compact-'+mark+'@example.test',name:'compact',passwordHash:'x'}});
 const org=await prisma.organization.create({data:{name:'compact',ownerId:owner.id}});
 await prisma.workspace.create({data:{ownerId:owner.id,data:initialState(false) as object,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+30*86400000)}});
 let s=initialState(true);s.orders=[];for(const p of s.products)p.stock=10000;
 for(let i=0;i<70;i++){
  s=applyAction(s,'createOrder',{name:'Client '+(i%9),phone:'2'+String(3000000+(i%9)).padStart(7,'0'),city:'Tunis',address:'Rue numéro '+i+' quartier',source:'Boutique',items:[{productId:'p1',quantity:1}]});
  const id=s.orders[0].id;for(const status of ['CONFIRMED','PREPARING','READY','SHIPPED','DELIVERED'])s=applyAction(s,'transition',{id,status,...(status==='SHIPPED'?{carrier:'Poste',tracking:'T'+i}:{})});
 }
 s.orders.forEach(o=>{o.createdAt=shift(o.createdAt,200);o.updatedAt=shift(o.updatedAt,200);o.events=o.events.map(e=>({...e,at:shift(e.at,200)}));});
 const original=structuredClone(s);
 const shop=await prisma.shop.create({data:{organizationId:org.id,name:'compact',slug:'compact-'+mark,status:'PUBLISHED'}});
 await prisma.shopCommerce.create({data:{shopId:shop.id,data:s as object}});
 await prisma.membership.create({data:{shopId:shop.id,userId:owner.id,role:'OWNER'}});
 try{
  await rebuildActivity(owner.id,shop.id,true);
  await writeIsolatedCommerce(owner.id,shop.id,{action:'stock',requestId:randomUUID(),payload:{id:'p2',quantity:1,reason:'Inventaire'}},()=>{});
  let saved=(await prisma.shopCommerce.findUnique({where:{shopId:shop.id}}))!.data as unknown as State;
  assert.equal(saved.orders.filter(o=>o.compactedAt).length,COMPACTION_BATCH,'bounded batch per write');
  assert.equal(await prisma.commerceOrderArchive.count({where:{sourceKind:'SHOP',sourceId:shop.id}}),COMPACTION_BATCH);
  const verified=await verifyActivity(owner.id,shop.id);
  assert.equal(verified.matches,true,'search copy in parity with the saved block');
  const one=saved.orders.find(o=>o.compactedAt)!,full=original.orders.find(o=>o.id===one.id)!;
  const archive=await prisma.commerceOrderArchive.findFirst({where:{sourceId:shop.id,orderId:one.id}});
  assert.deepEqual(archive!.events,full.events,'full history archived');
  assert.equal(one.total,full.total);assert.deepEqual(one.items,full.items);assert.deepEqual(one.customerSnapshot,full.customerSnapshot);

  await offloadAllHistories(prisma as never);
  saved=(await prisma.shopCommerce.findUnique({where:{shopId:shop.id}}))!.data as unknown as State;
  assert.equal(saved.orders.filter(o=>o.compactedAt).length,70,'catch-up compacts the rest');
  assert.equal(await prisma.commerceOrderArchive.count({where:{sourceId:shop.id}}),70);
  await offloadAllHistories(prisma as never);
  assert.equal(await prisma.commerceOrderArchive.count({where:{sourceId:shop.id}}),70,'idempotent');
  const csv=await historyCsv(prisma,{kind:'SHOP',id:shop.id},'events');
  assert.ok(csv.startsWith('"Date","Commande","Événement"'));
  assert.ok(csv.split('\r\n').length>70*5,'every archived event exported');
 }finally{
  await prisma.commerceOrderArchive.deleteMany({where:{sourceId:shop.id}});
  await prisma.commerceJournalEntry.deleteMany({where:{sourceId:shop.id}});await prisma.commerceStockMovement.deleteMany({where:{sourceId:shop.id}});
  await prisma.shop.deleteMany({where:{id:shop.id}});await prisma.workspace.deleteMany({where:{ownerId:owner.id}});
  await prisma.organization.deleteMany({where:{id:org.id}});await prisma.user.deleteMany({where:{id:owner.id}});
  await prisma.$disconnect();
 }
});
