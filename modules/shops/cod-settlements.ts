import {z} from 'zod';
import {writeIsolatedCommerce} from './aggregate-quotas';
import type {State} from '../commerce/types';

/** COD is always measured in integer millimes and may only be collected on delivered orders. */
export const codSettlementMutation=z.object({
 action:z.literal('settlement'),
 requestId:z.string().uuid(),
 payload:z.object({
  id:z.string().trim().min(1).max(160),
  amount:z.number().int().min(1).max(1_000_000_000),
  reference:z.string().trim().min(1).max(160)
 }).strict()
}).strict();

export function codBalances(state:State){
 return state.orders.filter(order=>order.status==='DELIVERED').map(order=>({
  id:order.id,reference:order.reference,totalMillimes:order.total,
  collectedMillimes:order.collected,
  remainingMillimes:Math.max(0,order.total-order.collected)
 })).sort((a,b)=>b.remainingMillimes-a.remainingMillimes||a.reference.localeCompare(b.reference));
}

export function codSettlementHistory(state:State){
 const orderReference=new Map(state.orders.map(order=>[order.id,order.reference]));
 return state.settlements.slice(0,100).map(entry=>({
  id:entry.id,orderReference:orderReference.get(entry.orderId)||'Commande indisponible',
  amountMillimes:entry.amount,reference:entry.reference,at:entry.at
 }));
}

export async function performShopCodSettlement(userId:string,shopId:string,input:z.infer<typeof codSettlementMutation>){
 return writeIsolatedCommerce(userId,shopId,input,()=>{});
}
