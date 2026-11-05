import {pageOperationalQueue} from './operational-queues';

export type MerchantCustomerRequest={
 id:string;type:'CANCEL'|'RETURN';reason:string;at:string;
 status:'PENDING'|'ACCEPTED'|'REJECTED';reply?:string
};
export type MerchantCustomerRequestOrder={
 id:string;reference:string;status:string;customerRequests?:MerchantCustomerRequest[]
};

/** Private merchant queue. No delivery, refunds, stocks or order status are changed. */
export function merchantCustomerRequestQueue<T extends MerchantCustomerRequestOrder>(
 orders:readonly T[],pendingPage=1,historyPage=1
){
 const pending:Array<{order:T;request:MerchantCustomerRequest}>=[];
 const history:Array<{order:T;request:MerchantCustomerRequest}>=[];
 for(const order of orders)for(const request of order.customerRequests||[]){
  const row={order,request};
  if(request.status==='PENDING')pending.push(row);
  else history.push(row);
 }
 const time=(at:string)=>{
  const value=Date.parse(at);return Number.isFinite(value)?value:0;
 };
 // Oldest unresolved requests first; newest decisions first.
 pending.sort((a,b)=>time(a.request.at)-time(b.request.at)||
  a.request.id.localeCompare(b.request.id));
 history.sort((a,b)=>time(b.request.at)-time(a.request.at)||
  a.request.id.localeCompare(b.request.id));
 return {
  pending:pageOperationalQueue(pending,pendingPage,25),
  history:pageOperationalQueue(history,historyPage,50)
 };
}
