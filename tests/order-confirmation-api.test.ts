import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)
 throw Error('Order confirmation requires matching disposable *_test PostgreSQL databases');
process.env.APP_URL='https://confirm.example.test';
const {prisma}=await import('../modules/storage/client');
const service=await import('../modules/shops/order-confirmation-service');
const {HttpError}=await import('../modules/auth/http');
const mark=randomUUID().slice(0,8);
const rejects=async(promise:Promise<unknown>,status:number)=>{await assert.rejects(promise,(error:unknown)=>error instanceof HttpError&&error.status===status);};

async function merchant(label:string){
 const owner=await prisma.user.create({data:{email:label+'-'+mark+'@example.test',name:label,passwordHash:'x'}});
 const agent=await prisma.user.create({data:{email:label+'-agent-'+mark+'@example.test',name:label+' agent',passwordHash:'x'}});
 const org=await prisma.organization.create({data:{name:label,ownerId:owner.id}});
 await prisma.workspace.create({data:{ownerId:owner.id,data:initialState(false) as object,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+30*86400000)}});
 let state=initialState(true);
 state=applyAction(state,'createOrder',{name:'Amira Ben Ali',phone:'22123456',city:'Tunis',address:'12 rue de Marseille',source:'Manuel',items:[{productId:'p1',quantity:1}]});
 const shop=await prisma.shop.create({data:{organizationId:org.id,name:label,slug:label+'-'+mark,status:'PUBLISHED'}});
 await prisma.shopCommerce.create({data:{shopId:shop.id,data:state as object}});
 await prisma.membership.create({data:{shopId:shop.id,userId:owner.id,role:'OWNER'}});
 await prisma.membership.create({data:{shopId:shop.id,userId:agent.id,role:'CALL_CENTER'}});
 return {owner,agent,shop,orderId:state.orders[0].id};
}
const orderOf=async(shopId:string,id:string)=>((await prisma.shopCommerce.findUnique({where:{shopId}}))!.data as any).orders.find((o:any)=>o.id===id);

test('confirmation link: call-center agent prepares it, customer answers once, other shops stay closed',async()=>{
 const a=await merchant('conf-a'),b=await merchant('conf-b');
 try{
  const prepared=await service.prepareConfirmationLink(a.agent.id,a.shop.id,a.orderId);
  const token=prepared.link.split('/confirmer/')[1];
  assert.equal(prepared.link,'https://confirm.example.test/vitrines/'+a.shop.slug+'/confirmer/'+token);
  assert.match(prepared.whatsappUrl||'',/^https:\/\/wa\.me\/21622123456\?text=/);
  assert.equal((await service.prepareConfirmationLink(a.owner.id,a.shop.id,a.orderId)).link,prepared.link,'link reused');
  await rejects(service.prepareConfirmationLink(b.owner.id,a.shop.id,a.orderId),403);
  assert.equal(await service.publicConfirmation(b.shop.slug,token),null,'token of another shop');
  const view=await service.publicConfirmation(a.shop.slug,token);
  assert.equal(view?.canAnswer,true);
  await rejects(service.submitCustomerConfirmation(b.shop.slug,token,{answer:'CONFIRMED'}),404);
  assert.deepEqual(await service.submitCustomerConfirmation(a.shop.slug,token,{answer:'CONFIRMED'}),{answer:'CONFIRMED',alreadyApplied:false});
  assert.deepEqual(await service.submitCustomerConfirmation(a.shop.slug,token,{answer:'CONFIRMED'}),{answer:'CONFIRMED',alreadyApplied:true},'double click');
  await rejects(service.submitCustomerConfirmation(a.shop.slug,token,{answer:'CANCELLED'}),409);
  const order=await orderOf(a.shop.id,a.orderId);
  assert.equal(order.status,'CONFIRMED');
  assert.ok(order.events.some((e:any)=>/via le lien client/.test(e.label)));
  assert.equal((await service.publicConfirmation(a.shop.slug,token))?.canAnswer,false);
  await rejects(service.prepareConfirmationLink(a.owner.id,a.shop.id,a.orderId),400);
 }finally{
  await prisma.shop.deleteMany({where:{id:{in:[a.shop.id,b.shop.id]}}});
  await prisma.workspace.deleteMany({where:{ownerId:{in:[a.owner.id,b.owner.id]}}});
  await prisma.organization.deleteMany({where:{id:{in:[a.shop.organizationId,b.shop.organizationId]}}});
  await prisma.user.deleteMany({where:{email:{contains:mark}}});
  await prisma.$disconnect();
 }
});
