import {z} from 'zod';
import {imageUrl} from '../platform/media';
import type {State} from '../commerce/types';
import {writeIsolatedCommerce} from './aggregate-quotas';

export const brandingMutation=z.object({
 action:z.literal('settings'),requestId:z.string().uuid(),
 payload:z.object({
  name:z.string().trim().min(2).max(160),
  description:z.string().trim().max(1000),
  phone:z.string().trim().max(30),
  address:z.string().trim().max(200),
  shipping:z.number().int().min(0).max(1000000000),
  logoUrl:imageUrl,bannerUrl:imageUrl
 }).strict()
}).strict();
export function merchantBrandingView(state:State){
 return {
  name:state.shop.name,description:state.shop.description||'',phone:state.shop.phone,
  address:state.shop.address,shipping:state.shop.shipping,
  logoUrl:state.shop.logoUrl||'',bannerUrl:state.shop.bannerUrl||''
 };
}
export async function performMerchantBranding(ownerId:string,shopId:string,input:z.infer<typeof brandingMutation>){
 return writeIsolatedCommerce(ownerId,shopId,input,()=>{});
}
