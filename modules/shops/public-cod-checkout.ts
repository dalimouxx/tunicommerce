import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {isPublicIsolatedShop} from './publication';
import {normalizeState} from '../commerce/normalize';
import {applyAction} from '../commerce/service';
import {governors,type State} from '../commerce/types';
import {assertMerchantAggregateQuotas} from './aggregate-quotas';
import {loadWorkspaceQuotas} from '../subscriptions/quotas';
import {assertPlanForNewCommerce} from './plan-growth-policy';
import {enqueueOrderMail} from '../messaging/order-mail-service';
import {syncCatalog} from './catalog-index-service';
import {syncActivity} from './activity-index-service';
import {enqueueBusinessWebhooks} from '../messaging/webhook-outbox';

export const publicCodCheckoutInput=z.object({
 requestId:z.string().uuid().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
 name:z.string().trim().min(2,'Indiquez votre nom et prénom').max(160,'Nom trop long'),
 phone:z.string().regex(/^(\+216)?[2459][0-9]{7}$/,'Numéro de téléphone tunisien invalide'),
 city:z.enum(governors as [string,...string[]],{error:'Gouvernorat invalide'}),
 address:z.string().trim().min(3,'Adresse de livraison trop courte').max(160,'Adresse trop longue'),
 coupon:z.string().trim().min(2,'Code promo invalide').max(30,'Code promo invalide').regex(/^[A-Za-z0-9_-]+$/,'Code promo invalide').optional(),
 items:z.array(z.object({productId:z.string().min(1).max(160),quantity:z.number().int().min(1).max(10)}).strict()).min(1).max(15)
}).strict();

export function validatePublicCart(input:z.infer<typeof publicCodCheckoutInput>){
 const distinct=new Set(input.items.map(item=>item.productId));
 if(distinct.size!==input.items.length)throw new HttpError(400,'Articles en double dans le panier');
 if(input.items.reduce((total,item)=>total+item.quantity,0)>30)throw new HttpError(400,'Panier limité à 30 articles');
}

/** Rehydrate a public checkout after a lost response, even when request cache rotates.
 * Prevent a reused request token from returning someone else's receipt details.
 */
export function publicCheckoutReplay(state:State,input:z.infer<typeof publicCodCheckoutInput>){
 const order=state.orders.find(item=>item.publicReceiptId===input.requestId);
 if(!order){
  if(state.requests.includes(input.requestId))
   throw new HttpError(409,'Reçu indisponible : contactez la boutique avec votre référence');
  return null;
 }
 const buyer=order.customerSnapshot;
 const canonical=(value:string)=>value.replace(/^\+216/,'');
 const ordered=order.items.map(item=>item.productId+':'+item.quantity).sort().join('|');
 const supplied=input.items.map(item=>item.productId+':'+item.quantity).sort().join('|');
 if(!buyer||buyer.name!==input.name||canonical(buyer.phone)!==canonical(input.phone)||
  buyer.city!==input.city||buyer.address!==input.address||ordered!==supplied)
  throw new HttpError(409,'Cette référence de commande appartient à une autre demande');
 return {accepted:true,alreadyApplied:true,reference:order.reference,
  totalMillimes:order.total,trackingToken:input.requestId};
}

/**
 * Checkout uses the same owner-wide advisory lock and aggregate quotas as merchant
 * writes. No public request may mutate legacy Workspace commerce.
 */
export async function createPublicCodOrder(slug:string,input:z.infer<typeof publicCodCheckoutInput>){
 validatePublicCart(input);
 const candidate=await prisma.shop.findUnique({where:{slug},select:{
  id:true,status:true,legacyWorkspaceId:true,organization:{select:{ownerId:true}}
 }});
 if(!candidate||candidate.legacyWorkspaceId!==null)throw new HttpError(404,'Boutique indisponible');
 const ownerId=candidate.organization.ownerId;
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${ownerId}))`;
  const shop=await tx.shop.findUnique({where:{id:candidate.id},select:{
   status:true,legacyWorkspaceId:true,
   commerce:{select:{data:true,version:true,catalogVersion:true,activityVersion:true}},
   organization:{select:{ownerId:true}}
  }});
  if(!shop||shop.organization.ownerId!==ownerId)throw new HttpError(404,'Boutique indisponible');
  const workspace=await tx.workspace.findUnique({where:{ownerId},select:{
   id:true,plan:true,data:true,subscriptionStatus:true,subscriptionEndsAt:true
  }});
  if(!isPublicIsolatedShop({
   status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,
   subscriptionStatus:workspace?.subscriptionStatus||'',
   subscriptionEndsAt:workspace?.subscriptionEndsAt||null
  }))throw new HttpError(404,'Boutique indisponible');
  const plan=workspace?await tx.subscriptionPlan.findUnique({where:{code:workspace.plan},select:{enabled:true}}):null;
  assertPlanForNewCommerce({status:workspace?.subscriptionStatus||'',expiresAt:workspace?.subscriptionEndsAt||null,planExists:!!plan,planEnabled:plan?.enabled===true});
  const row=shop.commerce!;
  const before=normalizeState(row.data as unknown as State);
  const replay=publicCheckoutReplay(before,input);
  if(replay)return replay;
  const phone=input.phone.replace(/^\+216/,'');
  const recentOrder=before.orders.find(order=>
   order.customerSnapshot?.phone?.replace(/^\+216/,'')===phone&&
   Date.now()-Date.parse(order.createdAt)<60_000&&
   ['TO_CONFIRM','NO_ANSWER','CALLBACK'].includes(order.status)
  );
  if(recentOrder)throw new HttpError(429,'Une commande récente utilise déjà ce téléphone. Réessayez dans une minute.');
  // Per-shop customer throttle is persisted across instances and retries, not in memory.
  const key='cod:'+createHash('sha256').update(candidate.id+':'+phone).digest('hex');
  const throttle=await tx.authThrottle.findUnique({where:{key}});
  if(throttle&&throttle.expiresAt>new Date()&&throttle.count>=3)
   throw new HttpError(429,'Trop de commandes depuis ce téléphone. Réessayez plus tard.');
  let next:State;
  try{
   next=applyAction(before,'createOrder',{
    name:input.name,phone:phone,city:input.city,address:input.address,
    source:'Boutique',items:input.items,coupon:input.coupon?.toUpperCase()
   });
  }catch(error){
   if(error instanceof z.ZodError)throw new HttpError(400,error.issues[0]?.message||'Commande invalide');
   throw new HttpError(409,error instanceof Error?error.message:'Commande invalide');
  }
  // Random v4 checkout request ID doubles as an unguessable, bearer-only tracking token.
  // No customer address or phone is exposed by the tracking view.
  next.orders[0].publicReceiptId=input.requestId;
  const quotas=await loadWorkspaceQuotas(workspace!,tx);
  const otherShops=await tx.shopCommerce.findMany({where:{
   shopId:{not:candidate.id},shop:{organization:{ownerId}}
  },select:{data:true}});
  assertMerchantAggregateQuotas([
   normalizeState(workspace!.data as unknown as State),
   ...otherShops.map(record=>normalizeState(record.data as unknown as State))
  ],before,next,quotas);
  next.requests=[...before.requests.slice(-999),input.requestId];
  const updated=await tx.shopCommerce.updateMany({where:{shopId:candidate.id,version:row.version},
   data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}});
  if(updated.count!==1)throw new HttpError(409,'Commande concurrente. Veuillez réessayer.');
  await enqueueOrderMail(tx,{shopId:candidate.id},before,next,row.version+1);
  await syncCatalog(tx,{shopId:candidate.id},before,next,row.catalogVersion);
  await syncActivity(tx,{shopId:candidate.id},before,next,row.activityVersion);
  await enqueueBusinessWebhooks(tx,{shopId:candidate.id},before,next,row.version+1);
  const newCount=throttle&&throttle.expiresAt>new Date()?throttle.count+1:1;
  const expiresAt=throttle&&throttle.expiresAt>new Date()?throttle.expiresAt:new Date(Date.now()+3600_000);
  await tx.authThrottle.upsert({where:{key},create:{key,count:1,expiresAt},
   update:{count:newCount,expiresAt}});
  const order=next.orders[0];
  return {accepted:true,alreadyApplied:false,reference:order.reference,totalMillimes:order.total,trackingToken:input.requestId};
 },{timeout:15000});
}
