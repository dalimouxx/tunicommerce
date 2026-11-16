import {labels,type Order,type State,type Status} from './types';

/** Closed orders older than this keep only what calculations read; details go to CommerceOrderArchive. */
export const COMPACTION_AGE_DAYS=90;
export const COMPACTION_BATCH=50;
export type OrderArchive={orderId:string;events:Order['events'];riskSignals?:unknown;confirmation?:unknown};
const closed=new Set<Status>(['DELIVERED','CANCELLED','RETURNED']);

function openBusiness(state:State,order:Order){
 if(order.customerRequests?.some(request=>request.status==='PENDING'))return true;
 if(state.invoices.some(invoice=>invoice.orderId===order.id&&invoice.status==='DRAFT'))return true;
 return state.returns.some(record=>record.orderId===order.id&&Number(record.refunded||0)<Number(record.credit||0));
}
/** Kept events: the latest one and the latest event of the final status (read for delivery/refusal dates). */
function keptEvents(order:Order){
 const events=order.events||[],last=events.at(-1);
 const statusLabel=labels[order.status as Status]||'';
 const statusEvent=[...events].reverse().find(event=>statusLabel&&event.label.startsWith(statusLabel));
 return [...new Set([statusEvent,last].filter(Boolean))].sort((a,b)=>events.indexOf(a!)-events.indexOf(b!)) as Order['events'];
}
function needsCompaction(order:Order){
 return !order.compactedAt||(order.events?.length||0)>2||order.riskSignals!==undefined||order.confirmation!==undefined;
}
/** Pure. Business fields (amounts, items, costs, customer copy, carrier, COD, dates, requests) are never touched. */
export function compactClosedOrders(state:State,now=new Date(),limit=COMPACTION_BATCH){
 const threshold=now.getTime()-COMPACTION_AGE_DAYS*86400000;
 const archived:OrderArchive[]=[];
 const orders=state.orders.map(order=>{
  if(archived.length>=limit||!closed.has(order.status as Status)||!needsCompaction(order))return order;
  const updated=Date.parse(order.updatedAt);
  if(!Number.isFinite(updated)||updated>=threshold||openBusiness(state,order))return order;
  const kept=keptEvents(order);
  if(order.compactedAt&&kept.length===order.events.length&&order.riskSignals===undefined&&order.confirmation===undefined)return order;
  archived.push({orderId:order.id,events:order.events,...(order.riskSignals!==undefined?{riskSignals:order.riskSignals}:{}),...(order.confirmation!==undefined?{confirmation:order.confirmation}:{})});
  const {riskSignals:_signals,confirmation:_confirmation,...rest}=order;
  return {...rest,events:kept,compactedAt:order.compactedAt||now.toISOString()} as Order;
 });
 return {state:archived.length?{...state,orders}:state,archived};
}
