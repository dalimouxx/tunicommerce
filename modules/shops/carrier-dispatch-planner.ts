import type {State} from '../commerce/types';

export function eligibleCarriers(state:Pick<State,'carriers'>,governorate:string){
 return (state.carriers||[]).filter(carrier=>carrier.active&&carrier.governorates.includes(governorate))
  .sort((a,b)=>a.deliveryCost-b.deliveryCost||a.name.localeCompare(b.name));
}
export type DispatchPrintFilter='ALL'|'READY'|'SHIPPED';
export const PRINT_SHIPMENT_PAGE_SIZE=40;
export function parseDispatchPrintQuery(raw:Record<string,string|string[]|undefined>){
 for(const key of Object.keys(raw))if(key!=='page'&&key!=='status')throw Error('Paramètres de bordereaux inconnus');
 const p=raw.page??'1',status=raw.status??'ALL';
 if(typeof p!=='string'||!/^[1-9][0-9]{0,3}$/.test(p))throw Error('Page de bordereaux invalide');
 if(typeof status!=='string'||!['ALL','READY','SHIPPED'].includes(status))throw Error('État de bordereaux invalide');
 return {page:Number(p),status:status as DispatchPrintFilter};
}
export function dispatchPrintPage(state:State,{page,status}:{page:number;status:DispatchPrintFilter}){
 if(!Number.isSafeInteger(page)||page<1)throw Error('Page invalide');
 const eligible=state.orders.filter(order=>(order.status==='READY'||order.status==='SHIPPED')&&
  (status==='ALL'||order.status===status));
 const total=eligible.length,totalPages=Math.max(1,Math.ceil(total/PRINT_SHIPMENT_PAGE_SIZE));
 if(page>totalPages)throw Error('Page de bordereaux introuvable');
 const start=(page-1)*PRINT_SHIPMENT_PAGE_SIZE;
 const rows=eligible.slice(start,start+PRINT_SHIPMENT_PAGE_SIZE).map(order=>{
   const buyer=order.customerSnapshot||state.customers.find(customer=>customer.id===order.customerId);
   const offers=eligibleCarriers(state,buyer?.city||'');
   return {
    id:order.id,reference:order.reference,status:order.status,
    recipient:buyer?.name||'',phone:buyer?.phone||'',city:buyer?.city||'',address:buyer?.address||'',
    codMillimes:order.total,carrier:order.carrier,tracking:order.tracking,
    items:order.items.map(item=>({name:item.name,variant:item.variant,quantity:item.quantity})),
    offers:offers.map(c=>({id:c.id,name:c.name,deliveryCostMillimes:c.deliveryCost,
      returnCostMillimes:c.returnCost}))
   };
  });
 return {rows,total,totalPages,page,status,pageSize:PRINT_SHIPMENT_PAGE_SIZE};
}
/** Backward-compatible first-page projection for existing callers. */
export function dispatchPrintRows(state:State){
 return dispatchPrintPage(state,{page:1,status:'ALL'}).rows;
}
