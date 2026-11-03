import type {State} from '../commerce/types';

export type CarrierCodRow={
 carrier:string;
 deliveredOrders:number;
 deliveredGrossMillimes:number;
 collectedMillimes:number;
 outstandingMillimes:number;
 recordedSettlements:number;
 settlementAmountsMillimes:number;
};

/**
 * Per-shop, read-only grouping of delivered orders by their last assigned carrier.
 * A delivery carrier assignment is not proof that the carrier holds COD funds.
 * Recorded settlements are linked by order ID, never inferred by matching references.
 */
export function carrierCodReport(state:State):CarrierCodRow[]{
 const groups=new Map<string,CarrierCodRow>();
 const carrierByDeliveredOrder=new Map<string,string>();
 for(const order of state.orders){
  if(order.status!=='DELIVERED')continue;
  const carrier=order.carrier.trim()||'Transporteur non renseigné';
  carrierByDeliveredOrder.set(order.id,carrier);
  const row=groups.get(carrier)||{
   carrier,deliveredOrders:0,deliveredGrossMillimes:0,collectedMillimes:0,
   outstandingMillimes:0,recordedSettlements:0,settlementAmountsMillimes:0
  };
  row.deliveredOrders++;
  row.deliveredGrossMillimes+=order.total;
  row.collectedMillimes+=Math.max(0,Math.min(order.total,order.collected));
  row.outstandingMillimes+=Math.max(0,order.total-order.collected);
  groups.set(carrier,row);
 }
 for(const settlement of state.settlements){
  const carrier=carrierByDeliveredOrder.get(settlement.orderId);
  if(!carrier)continue;
  const row=groups.get(carrier)!;
  row.recordedSettlements++;
  row.settlementAmountsMillimes+=settlement.amount;
 }
 return [...groups.values()].sort((a,b)=>b.outstandingMillimes-a.outstandingMillimes||a.carrier.localeCompare(b.carrier,'fr'));
}
