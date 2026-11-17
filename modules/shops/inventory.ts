import {z} from 'zod';
import {payloadPhotoIds} from '../product-media/gallery';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {writeIsolatedCommerce} from './aggregate-quotas';
import {applyAction} from '../commerce/service';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {assertCommerceQuotas,quotasForOwner} from '../subscriptions/quotas';
import {requireIsolatedOwner} from './isolated-commerce';

export const inventoryMutation=z.object({
 action:z.enum(['product','stock']),
 payload:z.unknown(),
 requestId:z.string().uuid()
}).strict();
/** Library photos are the shop owner's: each one named by the product must exist in the owner's library. */
export async function performShopInventoryAction(userId:string,shopId:string,input:z.infer<typeof inventoryMutation>){
 const ids=input.action==='product'?payloadPhotoIds(input.payload):[];
 return writeIsolatedCommerce(userId,shopId,input,()=>{},undefined,ids.length?async(tx,{ownerWorkspaceId})=>{
  const owned=await tx.productMedia.count({where:{id:{in:ids},workspaceId:ownerWorkspaceId}});
  if(owned!==ids.length)throw new HttpError(403,'Cette photo appartient à une autre boutique ou a été supprimée');
 }:undefined);
}
