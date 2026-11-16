import {createHash,createHmac} from 'node:crypto';
import type {State} from '../commerce/types';

/** Normalised Tunisian mobile number (8 digits) or null. */
export function normalizePhone(phone:string){
 const digits=phone.replace(/[\s.()-]/g,'').replace(/^(?:\+|00)216/,'');
 return /^[2459][0-9]{7}$/.test(digits)?digits:null;
}
/** Keyed hash: plain hashes of 10^8 possible numbers would be reversible. Disabled without APP_ENCRYPTION_SECRET. */
export function phoneKey(phone:string,env:Record<string,string|undefined>=process.env){
 const secret=env.APP_ENCRYPTION_SECRET;
 const normalized=normalizePhone(phone);
 if(!normalized||typeof secret!=='string'||secret.length<32)return null;
 const key=createHash('sha256').update('tunicom-customer-reliability-v1:'+secret).digest();
 return createHmac('sha256',key).update(normalized).digest('hex');
}
export type DeliveryOutcome={orderId:string;phone:string;outcome:'DELIVERED'|'REFUSED';occurredAt:string};
/** A refusal is a shipped order that came back (RETURNED is only reachable from SHIPPED). Cancellations never count. */
export function deliveryOutcomes(state:State):DeliveryOutcome[]{
 const customers=new Map(state.customers.map(customer=>[customer.id,customer]));
 return state.orders.flatMap(order=>{
  if(order.status!=='DELIVERED'&&order.status!=='RETURNED')return [];
  const phone=(order.customerSnapshot||customers.get(order.customerId))?.phone||'';
  const marker=order.status==='DELIVERED'?/livr/i:/retour/i;
  const event=[...order.events].reverse().find(item=>marker.test(item.label));
  const occurredAt=[event?.at,order.updatedAt,order.createdAt].find(value=>value&&!Number.isNaN(Date.parse(value)))||new Date(0).toISOString();
  return [{orderId:order.id,phone,outcome:order.status==='DELIVERED'?'DELIVERED' as const:'REFUSED' as const,occurredAt}];
 });
}
/** Pending or accepted contests are excluded; a rejected contest counts again. */
export function reliabilityCounts(rows:readonly {outcome:string;contestStatus:string|null}[]){
 let delivered=0,refused=0;
 for(const row of rows){
  if(row.outcome==='DELIVERED')delivered++;
  else if(row.outcome==='REFUSED'&&(row.contestStatus===null||row.contestStatus==='REJECTED'))refused++;
 }
 return {delivered,refused};
}
export {reliabilityLabel} from './notice';
