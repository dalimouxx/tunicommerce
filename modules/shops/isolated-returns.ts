import {z} from 'zod';
import {writeIsolatedCommerce} from './aggregate-quotas';
import type {State} from '../commerce/types';

const receive=z.object({
 orderId:z.string().min(1).max(160),
 productId:z.string().min(1).max(160),
 quantity:z.number().int().min(1).max(10000),
 reason:z.string().trim().min(3).max(500),
 condition:z.enum(['RESELLABLE','DAMAGED']),
 returnCost:z.number().int().min(0).max(1000000)
}).strict();
const refund=z.object({
 id:z.string().min(1).max(160),
 amount:z.number().int().min(1).max(1000000000),
 reference:z.string().trim().min(1).max(160)
}).strict();

export const isolatedReturnMutation=z.discriminatedUnion('action',[
 z.object({action:z.literal('receiveReturn'),requestId:z.string().uuid(),payload:receive}).strict(),
 z.object({action:z.literal('refundReturn'),requestId:z.string().uuid(),payload:refund}).strict()
]);

/** Only ship/return-related fields needed by a merchant are sent to the owner-scoped UI. */
export function isolatedReturnsView(state:State){
 return {
  orders:state.orders.filter(order=>order.status==='DELIVERED').slice(0,100).map(order=>({
   id:order.id,reference:order.reference,
   items:order.items.map(item=>({
    productId:item.productId,name:item.name,quantity:item.quantity,
    returned:state.returns.filter(ret=>ret.orderId===order.id&&ret.productId===item.productId)
     .reduce((sum,ret)=>sum+ret.quantity,0)
   }))
  })),
  returns:state.returns.slice(0,100).map(ret=>({
   id:ret.id,reference:ret.reference,orderId:ret.orderId,productId:ret.productId,
   quantity:ret.quantity,reason:ret.reason,condition:ret.condition,credit:ret.credit,
   refunded:ret.refunded,createdAt:ret.createdAt,returnCost:ret.returnCost,
   refunds:ret.refunds
  }))
 };
}

export async function performIsolatedReturn(userId:string,shopId:string,input:z.infer<typeof isolatedReturnMutation>){
 return writeIsolatedCommerce(userId,shopId,input,()=>{});
}
