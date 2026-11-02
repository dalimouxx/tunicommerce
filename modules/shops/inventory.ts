import {z} from 'zod';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {writeIsolatedCommerce} from './aggregate-quotas';
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
 disallowLegacyProductMedia(input.action,input.payload);
 return writeIsolatedCommerce(userId,shopId,input,enforcePilotProductCap);
}
