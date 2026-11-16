import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)
 throw Error('Customer reliability requires matching disposable *_test PostgreSQL databases');
process.env.APP_ENCRYPTION_SECRET=randomBytes(40).toString('hex');
const {prisma}=await import('../modules/storage/client');
const {writeIsolatedCommerce}=await import('../modules/shops/aggregate-quotas');
const reliability=await import('../modules/reliability/service');
const {HttpError}=await import('../modules/auth/http');
const mark=randomUUID().slice(0,8),phone='2'+String(Math.floor(Math.random()*1e7)).padStart(7,'0');
const rejects=async(promise:Promise<unknown>,status:number)=>{await assert.rejects(promise,(error:unknown)=>error instanceof HttpError&&error.status===status);};

async function merchant(label:string){
 const owner=await prisma.user.create({data:{email:label+'-'+mark+'@example.test',name:label,passwordHash:'x'}});
 const org=await prisma.organization.create({data:{name:label,ownerId:owner.id}});
 await prisma.workspace.create({data:{ownerId:owner.id,data:initialState(false) as object,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+30*86400000)}});
 let state=initialState(true);state.orders=[];
 state=applyAction(state,'createOrder',{name:'Client Test',phone,city:'Tunis',address:'12 rue de Marseille',source:'Manuel',items:[{productId:'p1',quantity:1}]});
 const token=randomUUID();state.orders[0].publicReceiptId=token;
 const shop=await prisma.shop.create({data:{organizationId:org.id,name:label,slug:label+'-'+mark,status:'PUBLISHED'}});
 await prisma.shopCommerce.create({data:{shopId:shop.id,data:state as object}});
 await prisma.membership.create({data:{shopId:shop.id,userId:owner.id,role:'OWNER'}});
 return {owner,shop,token,orderId:state.orders[0].id};
}
async function walk(m:{owner:{id:string};shop:{id:string};orderId:string},steps:string[]){
 for(const status of steps)await writeIsolatedCommerce(m.owner.id,m.shop.id,{action:'transition',requestId:randomUUID(),payload:{id:m.orderId,status,...(status==='SHIPPED'?{carrier:'Poste',tracking:'T-'+randomUUID().slice(0,8)}:{})}},()=>{});
}

test('cross-shop counts: refusals in one shop are visible to another, contests and decisions apply',async()=>{
 const a=await merchant('fia-a'),b=await merchant('fia-b'),c=await merchant('fia-c');
 try{
  await walk(a,['CONFIRMED','PREPARING','READY','SHIPPED','RETURNED']);
  await walk(b,['CONFIRMED','PREPARING','READY','SHIPPED','DELIVERED']);
  const rows=await prisma.customerDeliveryOutcome.findMany({where:{shopId:{in:[a.shop.id,b.shop.id]}}});
  assert.equal(rows.length,2);
  assert.ok(rows.every(row=>!row.phoneKey.includes(phone)),'number never stored in clear');
  const seen=await reliability.reliabilityForOrders(c.owner.id,c.shop.id,[c.orderId]);
  assert.deepEqual(seen[c.orderId],{delivered:1,refused:1});
  await rejects(reliability.reliabilityForOrders(c.owner.id,a.shop.id,[a.orderId]),403);
  assert.deepEqual(await reliability.reliabilityForOrders(c.owner.id,c.shop.id,[a.orderId]),{},'orders of another shop are ignored');

  const refusal=rows.find(row=>row.outcome==='REFUSED')!;
  const contested=await reliability.contestRefusal(a.shop.slug,a.token,'Je n’ai jamais été contacté par le livreur');
  assert.equal(contested.status,'PENDING');
  assert.deepEqual((await reliability.reliabilityForOrders(c.owner.id,c.shop.id,[c.orderId]))[c.orderId],{delivered:1,refused:0},'pending contest excluded');
  await rejects(reliability.contestRefusal(a.shop.slug,a.token,'encore une fois'),409);
  await rejects(reliability.contestRefusal(b.shop.slug,b.token,'livrée pourtant'),409);
  await rejects(reliability.contestRefusal(b.shop.slug,a.token,'mauvaise boutique'),404);
  const admin=await prisma.user.create({data:{email:'admin-fia-'+mark+'@example.test',name:'admin',passwordHash:'x',role:'ADMIN'}});
  assert.ok((await reliability.pendingContests()).some(item=>item.id===refusal.id));
  await reliability.decideContest(admin.id,{id:refusal.id,decision:'REJECTED'});
  assert.deepEqual((await reliability.reliabilityForOrders(c.owner.id,c.shop.id,[c.orderId]))[c.orderId],{delivered:1,refused:1},'rejected contest counts again');
  await rejects(reliability.decideContest(admin.id,{id:refusal.id,decision:'ACCEPTED'}),409);
  assert.ok(await prisma.platformAudit.findFirst({where:{actorId:admin.id,detail:{contains:'Contestation'}}}));

  await prisma.customerDeliveryOutcome.deleteMany({where:{shopId:{in:[a.shop.id,b.shop.id]}}});
  const rebuilt=await reliability.rebuildReliability();
  assert.ok(rebuilt.outcomes>=2);
  assert.deepEqual((await reliability.reliabilityForOrders(c.owner.id,c.shop.id,[c.orderId]))[c.orderId],{delivered:1,refused:1},'rebuild restores the history');
 }finally{
  await prisma.shop.deleteMany({where:{id:{in:[a.shop.id,b.shop.id,c.shop.id]}}});
  await prisma.workspace.deleteMany({where:{owner:{email:{contains:mark}}}});
  await prisma.organization.deleteMany({where:{owner:{email:{contains:mark}}}});
  await prisma.platformAudit.deleteMany({where:{detail:{contains:mark}}});
  await prisma.user.deleteMany({where:{email:{contains:mark}}});
  await prisma.$disconnect();
 }
});
