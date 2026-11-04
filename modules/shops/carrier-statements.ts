import {z} from 'zod';
import {writeIsolatedCommerce} from './aggregate-quotas';
import type {State} from '../commerce/types';

export const carrierStatementMutation=z.discriminatedUnion('action',[
 z.object({
  action:z.literal('recordCarrierStatement'),requestId:z.string().uuid(),
  payload:z.object({
   orderId:z.string().trim().min(1).max(160),
   reference:z.string().trim().min(1).max(160),
   amount:z.number().int().min(1).max(1000000000),
   date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }).strict()
 }).strict(),
 z.object({
  action:z.literal('reconcileCarrierStatement'),requestId:z.string().uuid(),
  payload:z.object({
   statementId:z.string().uuid(),
   settlementId:z.string().uuid(),
   proofReference:z.string().trim().min(6).max(160)
  }).strict()
 }).strict()
]);

/** Deliberately separates *manual matching* from actual cash or bank verification. */
export function carrierStatementsView(state:State){
 const statements=state.carrierStatements||[];
 const matches=state.carrierReconciliations||[];
 const matchByStatement=new Map(matches.map(row=>[row.statementId,row]));
 const matchedSettlementIds=new Set(matches.map(row=>row.settlementId));
 const orders=state.orders.filter(order=>order.status==='DELIVERED'&&!!order.carrier.trim())
  .slice(0,100).map(order=>{
   const recorded=state.settlements.filter(row=>row.orderId===order.id).reduce((sum,row)=>sum+row.amount,0);
   const ownStatements=statements.filter(row=>row.orderId===order.id);
   const declared=ownStatements.reduce((sum,row)=>sum+row.amount,0);
   const manuallyMatched=ownStatements.filter(row=>matchByStatement.has(row.id)).reduce((sum,row)=>sum+row.amount,0);
   return {
    id:order.id,reference:order.reference,carrier:order.carrier,
    grossMillimes:order.total,collectedMillimes:order.collected,
    remainingMillimes:Math.max(0,order.total-order.collected),
    recordedSettlementsMillimes:recorded,declaredStatementsMillimes:declared,
    declarationGapMillimes:declared-recorded,manuallyMatchedMillimes:manuallyMatched,
    unmatchedDeclaredMillimes:declared-manuallyMatched
   };
  });
 const byOrder=new Map(state.orders.map(order=>[order.id,order.reference]));
 const candidates=new Set(orders.map(order=>order.id));
 return {
  orders,
  statements:statements.slice(0,200).map(row=>{
   const match=matchByStatement.get(row.id);
   return {
    id:row.id,orderId:row.orderId,orderReference:byOrder.get(row.orderId)||'Commande indisponible',
    carrier:row.carrier,reference:row.reference,amountMillimes:row.amount,
    date:row.date,at:row.at,manuallyMatched:!!match,
    matchedSettlementId:match?.settlementId||null,proofReference:match?.proofReference||null,
    matchedAt:match?.at||null
   };
  }),
  settlements:state.settlements.filter(row=>candidates.has(row.orderId)).slice(0,200).map(row=>({
   id:row.id,orderId:row.orderId,reference:row.reference,
   amountMillimes:row.amount,at:row.at,manuallyMatched:matchedSettlementIds.has(row.id)
  })),
  summary:{
   manuallyMatchedStatements:matches.length,
   pendingStatements:statements.filter(row=>!matchByStatement.has(row.id)).length,
   pendingSettlements:state.settlements.filter(row=>candidates.has(row.orderId)&&!matchedSettlementIds.has(row.id)).length
  }
 };
}
export async function performCarrierStatement(userId:string,shopId:string,
 input:z.infer<typeof carrierStatementMutation>){
 return writeIsolatedCommerce(userId,shopId,input,()=>{});
}
