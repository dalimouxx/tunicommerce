import {z} from 'zod';
import type {State} from '../commerce/types';
import {writeIsolatedCommerce} from './aggregate-quotas';
export const couponMutation=z.discriminatedUnion('action',[
 z.object({
 action:z.literal('coupon'),requestId:z.string().uuid(),
 payload:z.object({
  code:z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/,'Code alphanumérique requis'),
  percent:z.number().int().min(1).max(70),
  limit:z.number().int().min(1).max(100000)
 }).strict()
 }).strict(),
 z.object({action:z.literal('setCouponActive'),requestId:z.string().uuid(),
  payload:z.object({id:z.string().uuid(),active:z.boolean()}).strict()}).strict()
]);

export function merchantCouponsView(state:State){
 return {coupons:state.coupons.map(c=>({
  id:c.id,code:c.code,percent:c.percent,limit:c.limit,used:c.used,
  remaining:Math.max(0,c.limit-c.used),active:c.active
 })).slice(-100).reverse()};
}
export async function performMerchantCouponAction(ownerId:string,shopId:string,input:z.infer<typeof couponMutation>){
 return writeIsolatedCommerce(ownerId,shopId,input,()=>{});
}
