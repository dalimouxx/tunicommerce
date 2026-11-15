import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)
 throw Error('Reviews require matching disposable *_test PostgreSQL databases');
const {prisma}=await import('../modules/storage/client');
const reviews=await import('../modules/reviews/service');
const {HttpError}=await import('../modules/auth/http');
const mark=randomUUID().slice(0,8),delivered=randomUUID(),pending=randomUUID();

async function merchant(label:string){
 const user=await prisma.user.create({data:{email:label+'-'+mark+'@example.test',name:label,passwordHash:'x'}});
 const org=await prisma.organization.create({data:{name:label,ownerId:user.id}});
 let state=initialState(true);state.demo=false;
 state=applyAction(state,'createOrder',{name:'Amira Ben Ali',phone:'22123456',city:'Tunis',address:'Rue de Marseille',source:'Boutique',items:[{productId:'p1',quantity:1}]});
 state=applyAction(state,'createOrder',{name:'Sami Trabelsi',phone:'22123457',city:'Tunis',address:'Rue de Rome',source:'Boutique',items:[{productId:'p2',quantity:1}]});
 state.orders[1].publicReceiptId=delivered;state.orders[1].status='DELIVERED';
 state.orders[0].publicReceiptId=pending;state.orders[0].status='SHIPPED';
 const shop=await prisma.shop.create({data:{organizationId:org.id,name:label,slug:label+'-'+mark,status:'PUBLISHED'}});
 await prisma.shopCommerce.create({data:{shopId:shop.id,data:state as object}});
 await prisma.membership.create({data:{shopId:shop.id,userId:user.id,role:'OWNER'}});
 return {user,shop};
}
const rejects=async(promise:Promise<unknown>,status:number)=>{await assert.rejects(promise,(error:unknown)=>error instanceof HttpError&&error.status===status);};

test('verified reviews: delivery proof, uniqueness, merchant reply and report, admin arbitration',async()=>{
 const a=await merchant('avis-a'),b=await merchant('avis-b');
 const input={requestId:randomUUID(),productId:'p1',rating:5,comment:'Excellent, livraison rapide'};
 try{
  await rejects(reviews.submitReview(a.shop.slug,pending,{...input,productId:'p2'}),409);
  await rejects(reviews.submitReview(b.shop.slug,randomUUID(),input),404);
  await rejects(reviews.submitReview(a.shop.slug,delivered,{...input,productId:'p2'}),400);
  const created=await reviews.submitReview(a.shop.slug,delivered,input);
  assert.equal(created.alreadyReviewed,false);
  const again=await reviews.submitReview(a.shop.slug,delivered,{...input,rating:1,requestId:randomUUID()});
  assert.equal(again.alreadyReviewed,true);
  let page=await reviews.productReviews(a.shop.id,'p1');
  assert.deepEqual(page.summary,{count:1,average:5});
  assert.equal(page.items[0].authorName,'Amira B.');
  assert.equal(page.items[0].comment,'Excellent, livraison rapide');
  assert.deepEqual(await reviews.shopRatings(a.shop.id),{p1:{count:1,average:5}});
  assert.deepEqual((await reviews.productReviews(b.shop.id,'p1')).summary,{count:0,average:0});
  const tracking=await reviews.reviewedProducts(a.shop.id,delivered);
  assert.deepEqual([...tracking],['p1']);

  const id=page.items[0].id;
  await rejects(reviews.applyMerchantReview(b.user.id,a.shop.id,{action:'reply',reviewId:id,reply:'intrus'}),404);
  await rejects(reviews.applyMerchantReview(b.user.id,b.shop.id,{action:'reply',reviewId:id,reply:'intrus'}),404);
  await reviews.applyMerchantReview(a.user.id,a.shop.id,{action:'reply',reviewId:id,reply:'Merci Amira !'});
  page=await reviews.productReviews(a.shop.id,'p1');
  assert.equal(page.items[0].merchantReply,'Merci Amira !');

  await reviews.applyMerchantReview(a.user.id,a.shop.id,{action:'report',reviewId:id,reason:'OFF_TOPIC'});
  assert.deepEqual((await reviews.productReviews(a.shop.id,'p1')).summary,{count:0,average:0},'reported review hidden');
  assert.ok((await reviews.reportedReviews()).some(item=>item.id===id&&item.shopName===a.shop.name));
  const admin=await prisma.user.create({data:{email:'admin-'+mark+'@example.test',name:'admin',passwordHash:'x',role:'ADMIN'}});
  await reviews.moderateReview(admin.id,{reviewId:id,decision:'RESTORE'});
  assert.equal((await reviews.productReviews(a.shop.id,'p1')).summary.count,1,'restored');
  await rejects(reviews.moderateReview(admin.id,{reviewId:id,decision:'REMOVE'}),409);
  await reviews.applyMerchantReview(a.user.id,a.shop.id,{action:'report',reviewId:id,reason:'ABUSE'});
  await reviews.moderateReview(admin.id,{reviewId:id,decision:'REMOVE'});
  assert.equal((await reviews.productReviews(a.shop.id,'p1')).summary.count,0,'removed');
  await rejects(reviews.applyMerchantReview(a.user.id,a.shop.id,{action:'report',reviewId:id,reason:'ABUSE'}),409);
  assert.ok(await prisma.platformAudit.findFirst({where:{actorId:admin.id,detail:{contains:'avis'}}}));
 }finally{
  await prisma.shop.deleteMany({where:{id:{in:[a.shop.id,b.shop.id]}}});
  await prisma.platformAudit.deleteMany({where:{detail:{contains:mark}}});
  await prisma.$disconnect();
 }
});
