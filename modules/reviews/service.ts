import {Prisma} from '@prisma/client';
import type {z} from 'zod';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {requireIsolatedOwner} from '../shops/isolated-commerce';
import {displayName,ratingSummary,type merchantReviewMutation,type moderationInput,type reviewInput} from './policy';

const tokenPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicSelect={id:true,rating:true,comment:true,authorName:true,merchantReply:true,repliedAt:true,createdAt:true} as const;

async function orderForToken(slug:string,token:string){
 if(!tokenPattern.test(token)||slug.length>180)throw new HttpError(404,'Commande introuvable');
 const shop=await prisma.shop.findUnique({where:{slug},select:{id:true,legacyWorkspaceId:true,commerce:{select:{data:true}}}});
 if(!shop||shop.legacyWorkspaceId!==null||!shop.commerce)throw new HttpError(404,'Commande introuvable');
 const state=normalizeState(shop.commerce.data as unknown as State);
 const order=state.orders.find(item=>item.publicReceiptId===token);
 if(!order)throw new HttpError(404,'Commande introuvable');
 const customer=order.customerSnapshot||state.customers.find(item=>item.id===order.customerId);
 return {shopId:shop.id,order,customerName:customer?.name||''};
}
/** Proof of purchase = the private tracking token of a delivered order containing the product. One review per order × product. */
export async function submitReview(slug:string,token:string,input:z.infer<typeof reviewInput>){
 const {shopId,order,customerName}=await orderForToken(slug,token);
 if(order.status!=='DELIVERED')throw new HttpError(409,'Vous pourrez donner votre avis une fois la commande livrée.');
 if(!order.items.some(item=>item.productId===input.productId))throw new HttpError(400,'Ce produit ne fait pas partie de cette commande.');
 const existing=await prisma.shopReview.findUnique({where:{shopId_orderId_productId:{shopId,orderId:order.id,productId:input.productId}},select:{id:true}});
 if(existing)return {alreadyReviewed:true};
 try{
  await prisma.shopReview.create({data:{shopId,productId:input.productId,orderId:order.id,rating:input.rating,comment:input.comment,authorName:displayName(customerName)}});
  return {alreadyReviewed:false};
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return {alreadyReviewed:true};
  throw error;
 }
}
export async function reviewedProducts(shopId:string,token:string){
 const shop=await prisma.shop.findUnique({where:{id:shopId},select:{commerce:{select:{data:true}}}});
 const order=shop?.commerce?normalizeState(shop.commerce.data as unknown as State).orders.find(item=>item.publicReceiptId===token):null;
 if(!order)return new Set<string>();
 const rows=await prisma.shopReview.findMany({where:{shopId,orderId:order.id},select:{productId:true}});
 return new Set(rows.map(row=>row.productId));
}
/** Published reviews only: reported and removed reviews never count nor show. */
export async function productReviews(shopId:string,productId:string){
 const [items,aggregate]=await Promise.all([
  prisma.shopReview.findMany({where:{shopId,productId,status:'PUBLISHED'},select:publicSelect,orderBy:[{createdAt:'desc'},{id:'asc'}],take:10}),
  prisma.shopReview.aggregate({where:{shopId,productId,status:'PUBLISHED'},_avg:{rating:true},_count:{_all:true}})
 ]);
 const count=aggregate._count._all;
 return {summary:{count,average:count?Math.round((aggregate._avg.rating||0)*10)/10:0},items};
}
export async function shopRatings(shopId:string){
 const rows=await prisma.shopReview.groupBy({by:['productId'],where:{shopId,status:'PUBLISHED'},_avg:{rating:true},_count:{_all:true}});
 return Object.fromEntries(rows.map(row=>[row.productId,{count:row._count._all,average:Math.round((row._avg.rating||0)*10)/10}])) as Record<string,{count:number;average:number}>;
}
export async function merchantReviews(userId:string,shopId:string){
 await requireIsolatedOwner(userId,shopId);
 const items=await prisma.shopReview.findMany({where:{shopId},orderBy:[{createdAt:'desc'},{id:'asc'}],take:200,
  select:{...publicSelect,productId:true,status:true,reportReason:true,reportedAt:true}});
 return {summary:ratingSummary(items),items};
}
export async function applyMerchantReview(userId:string,shopId:string,input:z.infer<typeof merchantReviewMutation>){
 await requireIsolatedOwner(userId,shopId);
 const review=await prisma.shopReview.findFirst({where:{id:input.reviewId,shopId},select:{id:true,status:true}});
 if(!review)throw new HttpError(404,'Avis introuvable');
 if(input.action==='reply'){
  await prisma.shopReview.update({where:{id:review.id},data:{merchantReply:input.reply||null,repliedAt:input.reply?new Date():null}});
  return {ok:true};
 }
 const updated=await prisma.shopReview.updateMany({where:{id:review.id,status:'PUBLISHED'},data:{status:'REPORTED',reportReason:input.reason,reportedAt:new Date()}});
 if(!updated.count)throw new HttpError(409,'Cet avis a déjà été signalé ou arbitré.');
 return {ok:true};
}
export async function reportedReviews(){
 const rows=await prisma.shopReview.findMany({where:{status:'REPORTED'},orderBy:{reportedAt:'asc'},take:200,
  select:{...publicSelect,productId:true,reportReason:true,reportedAt:true,shop:{select:{name:true,slug:true}}}});
 return rows.map(({shop,...row})=>({...row,shopName:shop.name,shopSlug:shop.slug}));
}
/** Super Admin decides only on reported reviews; every decision goes to the platform journal. */
export async function moderateReview(adminId:string,input:z.infer<typeof moderationInput>){
 const review=await prisma.shopReview.findUnique({where:{id:input.reviewId},select:{id:true,status:true,shop:{select:{name:true,legacyWorkspaceId:true,organization:{select:{owner:{select:{workspace:{select:{id:true}}}}}}}}}});
 if(!review)throw new HttpError(404,'Avis introuvable');
 const status=input.decision==='RESTORE'?'PUBLISHED':'REMOVED';
 return prisma.$transaction(async tx=>{
  const updated=await tx.shopReview.updateMany({where:{id:review.id,status:'REPORTED'},data:{status,moderatedAt:new Date(),moderatedBy:adminId}});
  if(!updated.count)throw new HttpError(409,'Cet avis n’est plus en attente d’arbitrage.');
  await tx.platformAudit.create({data:{actorId:adminId,workspaceId:review.shop.legacyWorkspaceId||review.shop.organization.owner.workspace?.id||'',
   detail:(status==='PUBLISHED'?'Avis rétabli':'Avis retiré')+' · '+review.shop.name+' · '+review.id}});
  return {status};
 });
}
