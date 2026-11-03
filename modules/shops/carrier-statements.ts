import {z} from 'zod';
import {writeIsolatedCommerce} from './aggregate-quotas';
import type {State} from '../commerce/types';

export const carrierStatementMutation=z.object({
 action:z.literal('recordCarrierStatement'),requestId:z.string().uuid(),
 payload:z.object({
  orderId:z.string().trim().min(1).max(160),
  reference:z.string().trim().min(1).max(160),
  amount:z.number().int().min(1).max(1000000000),
  date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
 }).strict()
}).strict();

export function carrierStatementsView(state:State){
 const statements=state.carrierStatements||[];
 const orders=state.orders.filter(order=>order.status==='DELIVERED'&&!!order.carrier.trim())
  .slice(0,100).map(order=>{
   const recorded=state.settlements.filter(row=>row.orderId===order.id).reduce((sum,row)=>sum+row.amount,0);
   const declared=statements.filter(row=>row.orderId===order.id).reduce((sum,row)=>sum+row.amount,0);
   return {
    id:order.id,reference:order.reference,carrier:order.carrier,
    grossMillimes:order.total,collectedMillimes:order.collected,
    remainingMillimes:Math.max(0,order.total-order.collected),
    recordedSettlementsMillimes:recorded,declaredStatementsMillimes:declared,
    declarationGapMillimes:declared-recorded
   };
  });
 const byOrder=new Map(state.orders.map(order=>[order.id,order.reference]));
 return {
  orders,
  statements:statements.slice(0,100).map(row=>({
   id:row.id,orderReference:byOrder.get(row.orderId)||'Commande indisponible',
   carrier:row.carrier,reference:row.reference,amountMillimes:row.amount,date:row.date,at:row.at
  }))
 };
}

export async function performCarrierStatement(userId:string,shopId:string,input:z.infer<typeof carrierStatementMutation>){
 return writeIsolatedCommerce(userId,shopId,input,()=>{});
}
