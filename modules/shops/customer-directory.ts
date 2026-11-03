import type {State} from '../commerce/types';

/** Owner-only view: never return address, notes, order contents or internal IDs. */
export function isolatedCustomerDirectory(state:State){
 return state.customers.slice(0,500).map(customer=>{
  const orders=state.orders.filter(order=>order.customerId===customer.id);
  const delivered=orders.filter(order=>order.status==='DELIVERED');
  return {
   name:customer.name,phone:customer.phone,city:customer.city,
   orderCount:orders.length,deliveredCount:delivered.length,
   deliveredGrossMillimes:delivered.reduce((sum,order)=>sum+order.total,0)
  };
 }).sort((a,b)=>b.orderCount-a.orderCount||a.name.localeCompare(b.name,'fr'));
}
