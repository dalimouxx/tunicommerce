import type {State} from '../commerce/types';
export type CommerceOrderEventType='ORDER_CREATED'|'ORDER_STATUS_CHANGED';
/** Operational metadata only, without buyer data or confidential tracking links. */
export function orderEventChanges(before:State,after:State){
 const previous=new Map(before.orders.map(order=>[order.id,order.status]));
 return after.orders.flatMap(order=>{
  const old=previous.get(order.id);
  const event:CommerceOrderEventType|undefined=old===undefined?'ORDER_CREATED':old!==order.status?'ORDER_STATUS_CHANGED':undefined;
  return event?[{event,orderId:order.id,reference:order.reference,status:order.status,total:order.total}]:[];
 });
}
