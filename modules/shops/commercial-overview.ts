import type {State} from '../commerce/types';

/** Bounded operational summary with no customer contact details or order contents. */
export function commercialOverview(state:State){
 const delivered=state.orders.filter(o=>o.status==='DELIVERED');
 const pending=state.orders.filter(o=>['TO_CONFIRM','NO_ANSWER','CALLBACK'].includes(o.status));
 return {
  products:state.products.length,
  stockUnits:state.products.reduce((sum,p)=>sum+Math.max(0,p.stock),0),
  orders:state.orders.length,
  pendingConfirmation:pending.length,
  delivered:delivered.length,
  customers:state.customers.length,
  deliveredGrossMillimes:delivered.reduce((sum,o)=>sum+o.total,0),
  codOutstandingMillimes:delivered.reduce((sum,o)=>sum+Math.max(0,o.total-o.collected),0)
 };
}
export function mayReadOwnCommercialOverview(input:{
 active:boolean;role:string;workspaceOwnerId:string|null;userId:string
}):boolean{
 return input.active&&input.role==='OWNER'&&input.workspaceOwnerId===input.userId;
}
