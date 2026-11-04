import {z} from 'zod';
import type {State} from '../commerce/types';
import {writeIsolatedCommerce} from './aggregate-quotas';

export const carrierHandoffInput=z.object({
 action:z.literal('recordCarrierHandoff'),
 requestId:z.string().uuid(),
 payload:z.object({
  orderId:z.string().uuid(),
  proofReference:z.string().trim().min(6).max(160)
 }).strict()
}).strict();

/** Expose only necessary shipment data on an authenticated merchant endpoint. */
export function carrierHandoffOverview(state:State){
 const receipts=state.carrierHandoffs||[];
 const receiptByOrder=new Map(receipts.map(receipt=>[receipt.orderId,receipt]));
 return {
  pending:state.orders.filter(order=>order.status==='SHIPPED'&&!receiptByOrder.has(order.id))
   .slice(0,100).map(order=>({id:order.id,reference:order.reference,carrier:order.carrier,
    tracking:order.tracking,createdAt:order.createdAt})),
  receipts:receipts.slice(0,100).map(receipt=>{
   const order=state.orders.find(item=>item.id===receipt.orderId);
   return {id:receipt.id,orderReference:order?.reference||'Commande supprimée',
    carrier:receipt.carrier,tracking:receipt.tracking,proofReference:receipt.proofReference,at:receipt.at};
  }),
  totalRecorded:receipts.length,
  pendingCount:state.orders.filter(order=>order.status==='SHIPPED'&&!receiptByOrder.has(order.id)).length
 };
}
export async function performCarrierHandoff(ownerId:string,shopId:string,input:z.infer<typeof carrierHandoffInput>){
 return writeIsolatedCommerce(ownerId,shopId,input,()=>{});
}
