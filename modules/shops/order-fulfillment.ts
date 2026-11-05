import {labels,type State,type Status} from '../commerce/types';
import {canRequest} from '../platform/tracking';
import {publicTrackingProgress} from './public-tracking-progress';

export const fulfillmentStatuses=['CONFIRMED','PREPARING','READY','SHIPPED'] as const;
export function fulfillmentQueue<T extends {status:string;createdAt:string}>(orders:readonly T[]):T[]{
 const rank:Record<string,number>={CONFIRMED:0,PREPARING:1,READY:2,SHIPPED:3};
 return orders.filter(order=>fulfillmentStatuses.some(status=>status===order.status))
  .sort((a,b)=>rank[a.status]-rank[b.status]||Date.parse(a.createdAt)-Date.parse(b.createdAt));
}

/** Bearer-token-only view. Never expose customer details, internal notes, prices at cost,
 * movement/audit events, payments, fraud signals, or other tenants' orders.
 */
export function publicTrackingView(state:State,token:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))return null;
 const order=state.orders.find(order=>order.publicReceiptId===token);
 if(!order)return null;
 return {
  reference:order.reference,
  status:order.status,
  statusLabel:labels[order.status as Status],
  progress:publicTrackingProgress(order.status),
  createdAt:order.createdAt,
  updatedAt:order.updatedAt,
  totalMillimes:order.total,
  items:order.items.map(item=>({name:item.name,variant:item.variant,quantity:item.quantity})),
  carrier:order.status==='SHIPPED'||order.status==='DELIVERED'?order.carrier:'',
  tracking:order.status==='SHIPPED'||order.status==='DELIVERED'?order.tracking:'',
  requests:(order.customerRequests||[]).map(({id,type,status,at,reply})=>({id,type,status,at,reply:reply||''})),
  canCancel:canRequest(order,'CANCEL')&&!order.customerRequests?.some(row=>row.status==='PENDING')&&
   (order.customerRequests?.length||0)<5,
  canReturn:canRequest(order,'RETURN')&&!order.customerRequests?.some(row=>row.status==='PENDING')&&
   (order.customerRequests?.length||0)<5
 };
}
