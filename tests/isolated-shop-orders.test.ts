import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {enforcePilotOrderCap,orderMutation,PILOT_MAX_ORDERS} from '../modules/shops/orders';

const validRequestId='123e4567-e89b-42d3-a456-426614174012';
test('pilot mutation excludes refunds, settlement, reset and arbitrary writes',()=>{
 for(const action of ['settlement','refundReturn','reset','product'])
  assert.equal(orderMutation.safeParse({action,payload:{},requestId:validRequestId}).success,false);
 assert.equal(orderMutation.safeParse({action:'createOrder',payload:{},requestId:validRequestId}).success,true);
});
test('a manual order reserves stock only in its supplied store snapshot',()=>{
 const original=initialState(false);
 const seeded=applyAction(original,'product',{
  name:'Chaussettes',sku:'SOC-1',category:'Mode',variant:'Noir',
  price:20000,cost:8000,stock:9,threshold:2,color:'#aabbcc'
 });
 const copy=structuredClone(seeded);
 const next=applyAction(seeded,'createOrder',{
  name:'Client test',phone:'22123456',city:'Gabès',address:'Avenue principale',
  source:'Manuel',items:[{productId:seeded.products[0].id,quantity:2}]
 });
 assert.equal(copy.products[0].stock,9);
 assert.equal(next.products[0].stock,7);
 assert.equal(next.orders[0].status,'TO_CONFIRM');
 assert.equal(next.customers.length,1);
});
test('pilot cap denies new orders beyond ceiling but preserves previous records',()=>{
 const before=initialState(false);
 const after=structuredClone(before);
 const now=new Date();
 after.orders=Array.from({length:PILOT_MAX_ORDERS+1},(_,i)=>({
  id:String(i),reference:'TC-'+i,customerId:'x',items:[],status:'TO_CONFIRM' as const,
  source:'Manuel',subtotal:0,discount:0,shipping:0,deliveryCost:0,total:0,collected:0,
  carrier:'',tracking:'',notes:'',createdAt:now.toISOString(),updatedAt:now.toISOString(),callbackAt:'',events:[]
 }));
 assert.throws(()=>enforcePilotOrderCap(before,after,now));
 assert.equal(before.orders.length,0);
});
