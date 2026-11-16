import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialState} from '../modules/commerce/seed';
import type {State} from '../modules/commerce/types';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)
 throw Error('History offload requires matching disposable *_test PostgreSQL databases');
const {prisma}=await import('../modules/storage/client');
const {writeIsolatedCommerce}=await import('../modules/shops/aggregate-quotas');
const {offloadAllHistories,historyCsv,HISTORY_WINDOW}=await import('../modules/commerce/history');
const mark=randomUUID().slice(0,8);
const big=(prefix:string,n:number)=>{const s=initialState(true);
 s.audit=Array.from({length:n},(_,i)=>({id:prefix+'-a'+i,at:new Date(Date.UTC(2026,0,1)+(n-i)*60000).toISOString(),label:'Action '+i}));
 s.movements=Array.from({length:n},(_,i)=>({id:prefix+'-m'+i,productId:'p1',label:i===0?'=HYPERLINK("x")':'Mouvement '+i,quantity:i%2?2:-1,at:new Date(Date.UTC(2026,0,1)+(n-i)*60000).toISOString()}));
 return s;};

test('history leaves the JSON block without loss, idempotently, and business data is untouched',async()=>{
 const owner=await prisma.user.create({data:{email:'hist-'+mark+'@example.test',name:'hist',passwordHash:'x'}});
 const org=await prisma.organization.create({data:{name:'hist',ownerId:owner.id}});
 const legacyState=big('ws-'+mark,300);
 const workspace=await prisma.workspace.create({data:{ownerId:owner.id,data:legacyState as object,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+30*86400000)}});
 const shopState=big('shop-'+mark,450);
 const shop=await prisma.shop.create({data:{organizationId:org.id,name:'hist',slug:'hist-'+mark,status:'PUBLISHED'}});
 await prisma.shopCommerce.create({data:{shopId:shop.id,data:shopState as object}});
 await prisma.membership.create({data:{shopId:shop.id,userId:owner.id,role:'OWNER'}});
 try{
  const stockBefore=shopState.products.map(p=>p.stock);
  await writeIsolatedCommerce(owner.id,shop.id,{action:'stock',requestId:randomUUID(),payload:{id:'p1',quantity:3,reason:'Réception fournisseur'}},()=>{});
  const after=(await prisma.shopCommerce.findUnique({where:{shopId:shop.id}}))!.data as unknown as State;
  assert.equal(after.audit.length,HISTORY_WINDOW);assert.equal(after.movements.length,HISTORY_WINDOW);
  assert.equal(after.products.find(p=>p.id==='p1')!.stock,stockBefore[0]+3,'stock computed as before');
  assert.deepEqual(after.orders,shopState.orders,'orders identical');
  const src={sourceKind:'SHOP',sourceId:shop.id};
  assert.equal(await prisma.commerceJournalEntry.count({where:src}),451,'450 old entries + the new action');
  assert.equal(await prisma.commerceStockMovement.count({where:src}),451);
  await writeIsolatedCommerce(owner.id,shop.id,{action:'stock',requestId:randomUUID(),payload:{id:'p1',quantity:-1,reason:'Casse'}},()=>{});
  assert.equal(await prisma.commerceJournalEntry.count({where:src}),452,'no duplicates on later writes');

  const first=await offloadAllHistories(prisma as never);
  assert.ok(first.trimmed>=1);
  const ws=(await prisma.workspace.findUnique({where:{id:workspace.id}}))!.data as unknown as State;
  assert.equal(ws.audit.length,HISTORY_WINDOW);
  assert.equal(await prisma.commerceJournalEntry.count({where:{sourceKind:'WORKSPACE',sourceId:workspace.id}}),300);
  assert.deepEqual(ws.products,legacyState.products);
  assert.deepEqual(ws.orders,legacyState.orders);
  const again=await offloadAllHistories(prisma as never);
  assert.equal(await prisma.commerceJournalEntry.count({where:{sourceKind:'WORKSPACE',sourceId:workspace.id}}),300,'idempotent');
  assert.ok(again.trimmed<=first.trimmed);

  const csv=await historyCsv(prisma,{kind:'SHOP',id:shop.id},'movements');
  assert.ok(csv.startsWith('"Date","Produit","Motif","Quantité","Commande"'));
  assert.ok(csv.includes(',-1,'),'quantities stay numeric');
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'),'formula neutralised');
  assert.equal(csv.trim().split('\r\n').length,453,'header + every movement');
 }finally{
  await prisma.commerceJournalEntry.deleteMany({where:{sourceId:{in:[shop.id,workspace.id]}}});
  await prisma.commerceStockMovement.deleteMany({where:{sourceId:{in:[shop.id,workspace.id]}}});
  await prisma.shop.deleteMany({where:{id:shop.id}});await prisma.workspace.deleteMany({where:{id:workspace.id}});
  await prisma.organization.deleteMany({where:{id:org.id}});await prisma.user.deleteMany({where:{id:owner.id}});
  await prisma.$disconnect();
 }
});
