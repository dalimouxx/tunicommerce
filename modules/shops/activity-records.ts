import {z} from 'zod';
import type {Prisma,ShopActivityOrder,ShopActivityCustomer} from '@prisma/client';
import type {State,Order,Customer} from '../commerce/types';
import {activitySearch,activityStatuses} from './activity-query';
const exact=z.number().int().nonnegative();
const orderCore=z.object({id:z.string().min(1),reference:z.string(),customerId:z.string(),status:z.enum(activityStatuses),source:z.string(),total:exact,collected:exact,createdAt:z.string()}).passthrough();
const customerCore=z.object({id:z.string().min(1),name:z.string(),phone:z.string(),city:z.string(),address:z.string(),notes:z.string()}).passthrough();
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function exactActivityNumber(value:bigint){const n=Number(value);if(!Number.isSafeInteger(n))throw Error('Montant hors limites');return n;}
export function activityRecords(shopId:string,state:State){
 if(!Array.isArray(state.orders)||!Array.isArray(state.customers)||state.orders.length>50_000||state.customers.length>50_000)throw Error('Volume historique à préparer');
 const orders=state.orders.map(o=>orderCore.parse(o)),customers=state.customers.map(c=>customerCore.parse(c));
 if(new Set(orders.map(o=>o.id)).size!==orders.length||new Set(customers.map(c=>c.id)).size!==customers.length)throw Error('Identifiants en double');
 const directory=new Map(customers.map(c=>[c.id,c]));
 const stats=new Map<string,{orderCount:number;deliveredCount:number;deliveredGross:bigint}>();
 for(const order of orders){const s=stats.get(order.customerId)??{orderCount:0,deliveredCount:0,deliveredGross:BigInt(0)};s.orderCount++;if(order.status==='DELIVERED'){s.deliveredCount++;s.deliveredGross+=BigInt(order.total);}stats.set(order.customerId,s);}
 const orderRows=orders.map((o,ordinal)=>{
  const {id,reference,customerId,status,source,total,collected,createdAt,...extra}=o;
  const customer=state.orders[ordinal].customerSnapshot??directory.get(customerId);
  const customerName=customer?.name??'',customerPhone=customer?.phone??'',customerCity=customer?.city??'';
  if([customerName,customerPhone,customerCity].some(v=>typeof v!=='string'))throw Error('Client historique invalide');
  return {shopId,orderId:id,ordinal,reference,customerId,status,source,total:BigInt(total),collected:BigInt(collected),createdAt,customerName,customerPhone,customerCity,
   searchText:activitySearch([reference,customerName,customerPhone,customerCity,state.orders[ordinal].carrier,state.orders[ordinal].tracking].join(' ')),extra:json(extra)};
 });
 for(const s of stats.values())exactActivityNumber(s.deliveredGross);
 const customerRows=customers.map((c,ordinal)=>{const {id,name,phone,city,address,notes,...extra}=c;return {shopId,customerId:id,ordinal,name,phone,city,address,notes,
  ...(stats.get(id)??{orderCount:0,deliveredCount:0,deliveredGross:BigInt(0)}),searchText:activitySearch([name,phone,city].join(' ')),extra:json(extra)};});
 return {orders:orderRows,customers:customerRows};
}
export function activityOrderValue(row:ShopActivityOrder):Order{return {...row.extra as Record<string,unknown>,id:row.orderId,reference:row.reference,customerId:row.customerId,status:row.status,source:row.source,total:exactActivityNumber(row.total),collected:exactActivityNumber(row.collected),createdAt:row.createdAt} as Order;}
export function activityCustomerValue(row:ShopActivityCustomer):Customer{return {...row.extra as Record<string,unknown>,id:row.customerId,name:row.name,phone:row.phone,city:row.city,address:row.address,notes:row.notes} as Customer;}
export function activityOrderSummary(row:Pick<ShopActivityOrder,'orderId'|'reference'|'status'|'source'|'total'|'collected'|'createdAt'|'customerName'|'customerPhone'|'customerCity'>){return {id:row.orderId,reference:row.reference,status:row.status as Order['status'],source:row.source,total:exactActivityNumber(row.total),collected:exactActivityNumber(row.collected),createdAt:row.createdAt,customerName:row.customerName,customerPhone:row.customerPhone,customerCity:row.customerCity};}
export function activityCustomerSummary(row:Pick<ShopActivityCustomer,'customerId'|'name'|'phone'|'city'|'orderCount'|'deliveredCount'|'deliveredGross'>){return {id:row.customerId,name:row.name,phone:row.phone,city:row.city,orderCount:row.orderCount,deliveredCount:row.deliveredCount,deliveredGross:exactActivityNumber(row.deliveredGross)};}
