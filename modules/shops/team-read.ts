import {canAccessShop,type ShopPermission} from './permissions';
import type {State} from '../commerce/types';
import {commercialOverview} from './commercial-overview';
import {contactHistory} from './contact-history';

export type TeamSection='products'|'orders'|'finance';
export function sectionPermission(section:TeamSection):ShopPermission{
 return section==='products'?'products.read':section==='orders'?'orders.read':'finance.read';
}
export function teamCanView(role:string,section:TeamSection){
 return canAccessShop(role,sectionPermission(section));
}
export function projectTeamSection(state:State,role:string,section:TeamSection){
 if(!teamCanView(role,section))return null;
 if(section==='products')return {
  section,
  products:state.products.map(p=>({
   id:p.id,name:p.name,sku:p.sku,variant:p.variant,
   price:p.price,stock:p.stock,threshold:p.threshold,active:p.active
  }))
 };
 if(section==='orders'){
  const personalData=canAccessShop(role,'customers.read');
  return {
   section,
   orders:state.orders.slice(0,100).map(o=>({
    id:o.id,reference:o.reference,status:o.status,
    createdAt:o.createdAt,source:o.source,
    items:o.items.map(item=>({name:item.name,quantity:item.quantity})),
    ...(canAccessShop(role,'orders.update')?{contactLog:contactHistory(o).slice(0,5)}:{}),
    // No pricing for users without finance rights; no buyer data without customers.read.
    ...(canAccessShop(role,'finance.read')?{total:o.total,collected:o.collected}:{}),
    ...(personalData?{customer:{
     name:o.customerSnapshot?.name??state.customers.find(c=>c.id===o.customerId)?.name??'',
     phone:o.customerSnapshot?.phone??state.customers.find(c=>c.id===o.customerId)?.phone??'',
     city:o.customerSnapshot?.city??state.customers.find(c=>c.id===o.customerId)?.city??''
    }}:{})
   }))
  };
 }
 const totals=commercialOverview(state);
 return {
  section,
  summary:{
   delivered:totals.delivered,
   deliveredGrossMillimes:totals.deliveredGrossMillimes,
   codOutstandingMillimes:totals.codOutstandingMillimes
  }
 };
}
