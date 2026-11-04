import type {State} from '../commerce/types';

export function eligibleCarriers(state:Pick<State,'carriers'>,governorate:string){
 return (state.carriers||[]).filter(carrier=>carrier.active&&carrier.governorates.includes(governorate))
  .sort((a,b)=>a.deliveryCost-b.deliveryCost||a.name.localeCompare(b.name));
}
export function dispatchPrintRows(state:State){
 return state.orders.filter(order=>order.status==='READY'||order.status==='SHIPPED').slice(0,40)
  .map(order=>{
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
}
