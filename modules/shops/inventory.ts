import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {applyAction} from '../commerce/service';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {assertCommerceQuotas,quotasForOwner} from '../subscriptions/quotas';
import {requireIsolatedOwner} from './isolated-commerce';

// Additional pilot guard until organization-wide shop/plan accounting is implemented.
export const PILOT_MAX_PRODUCTS=20;
export const inventoryMutation=z.object({
 action:z.enum(['product','stock']),
 payload:z.unknown(),
 requestId:z.string().uuid()
}).strict();
export function disallowLegacyProductMedia(action:'product'|'stock',payload:unknown){
 if(action!=='product')return;
 if(payload&&typeof payload==='object'&&!Array.isArray(payload)){
  const url=(payload as Record<string,unknown>).imageUrl;
  if(typeof url==='string'&&url.startsWith('/api/media/products/'))
   throw new HttpError(409,'Les photos de la bibliothèque historique ne sont pas liées à cette boutique.');
 }
}
export function enforcePilotProductCap(previous:State,next:State){
 if(next.products.length>previous.products.length&&next.products.length>PILOT_MAX_PRODUCTS)
  throw new HttpError(409,'Plafond provisoire de '+PILOT_MAX_PRODUCTS+' produits pour les nouvelles boutiques.');
}
export async function performShopInventoryAction(userId:string,shopId:string,input:z.infer<typeof inventoryMutation>){
 // Membership is checked before any shop data is retrieved, and again on each retry.
 await requireIsolatedOwner(userId,shopId);
 disallowLegacyProductMedia(input.action,input.payload);
 const quota=await quotasForOwner(userId); // fail closed if no merchant billing workspace exists
 for(let attempt=0;attempt<4;attempt++){
  await requireIsolatedOwner(userId,shopId);
  const row=await prisma.shopCommerce.findUnique({where:{shopId},select:{data:true,version:true}});
  if(!row)throw new HttpError(409,'Initialisez votre boutique avant de gérer son catalogue.');
  const previous=normalizeState(row.data as unknown as State);
  if(previous.requests.includes(input.requestId))
   return {state:previous,version:row.version,alreadyApplied:true};
  let next:State;
  try{next=applyAction(previous,input.action,input.payload);}
  catch(error){
   if(error instanceof z.ZodError)throw new HttpError(400,error.issues[0]?.message||'Produit invalide');
   throw new HttpError(400,error instanceof Error?error.message:'Opération invalide');
  }
  enforcePilotProductCap(previous,next);
  assertCommerceQuotas(previous,next,quota);
  next.requests=[...previous.requests.slice(-999),input.requestId];
  const result=await prisma.shopCommerce.updateMany({
   where:{shopId,version:row.version},
   data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}
  });
  if(result.count===1)return {state:next,version:row.version+1,alreadyApplied:false};
 }
 throw new HttpError(409,'Modification simultanée. Actualisez et réessayez.');
}
