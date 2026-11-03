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
import {enforcePilotOrderCap} from './orders';
import {loadWorkspaceQuotas} from '../subscriptions/quotas';

export const publicCodCheckoutInput=z.object({
 requestId:z.string().uuid(),
 name:z.string().trim().min(2).max(160),
 phone:z.string().regex(/^(\\+216)?[2459][0-9]{7}$/),
 city:z.enum(governors as [string,...string[]]),
 address:z.string().trim().min(3).max(160),
 items:z.array(z.object({productId:z.string().min(1).max(160),quantity:z.number().int().min(1).max(10)}).strict()).min(1).max(15)
}).strict();

export function validatePublicCart(input:z.infer<typeof publicCodCheckoutInput>){
 const distinct=new Set(input.items.map(item=>item.productId));
 if(distinct.size!==input.items.length)throw new HttpError(400,'Articles en double dans le panier');
 if(input.items.reduce((total,item)=>total+item.quantity,0)>30)throw new HttpError(400,'Panier limité à 30 articles');
}

export function publicCheckoutReceipt(state:State,requestId:string){
 const requestIndex=state.requests.indexOf(requestId);
 // A successful new mutation always puts its order first. For a replay, return only
 // an acknowledgement: never infer a different customer's order by searching PII.
 return {accepted:true,alreadyApplied:requestIndex>=0};
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
   commerce:{select:{data:true,version:true}},
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
  const row=shop.commerce!;
  const before=normalizeState(row.data as unknown as State);
  if(before.requests.includes(input.requestId))return {accepted:true,alreadyApplied:true};
  const phone=input.phone.replace(/^\\+216/,'');
  const recentOrder=before.orders.find(order=>
   order.customerSnapshot?.phone===phone&&
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
    name:input.name,phone:input.phone,city:input.city,address:input.address,
    source:'Boutique',items:input.items
   });
  }catch(error){
   if(error instanceof z.ZodError)throw new HttpError(400,error.issues[0]?.message||'Commande invalide');
   throw new HttpError(409,error instanceof Error?error.message:'Commande invalide');
  }
  enforcePilotOrderCap(before,next);
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
  const newCount=throttle&&throttle.expiresAt>new Date()?throttle.count+1:1;
  const expiresAt=throttle&&throttle.expiresAt>new Date()?throttle.expiresAt:new Date(Date.now()+3600_000);
  await tx.authThrottle.upsert({where:{key},create:{key,count:1,expiresAt},
   update:{count:newCount,expiresAt}});
  const order=next.orders[0];
  return {accepted:true,alreadyApplied:false,reference:order.reference,totalMillimes:order.total};
 },{timeout:15000});
}
