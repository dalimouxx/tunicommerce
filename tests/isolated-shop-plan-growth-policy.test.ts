import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {isCommerceGrowth,assertPlanForNewCommerce} from '../modules/shops/plan-growth-policy';
const now=new Date('2026-11-03T12:00:00Z');
const active={status:'ACTIVE',expiresAt:new Date('2026-12-01'),planExists:true,planEnabled:true};
test('expired, disabled and absent subscriptions cannot create new commerce',()=>{
 assert.doesNotThrow(()=>assertPlanForNewCommerce(active,now));
 assert.throws(()=>assertPlanForNewCommerce({...active,status:'SUSPENDED'},now),/Abonnement/);
 assert.throws(()=>assertPlanForNewCommerce({...active,expiresAt:new Date('2026-01-01')},now),/Abonnement/);
 assert.throws(()=>assertPlanForNewCommerce({...active,planExists:false},now),/offre/);
 assert.throws(()=>assertPlanForNewCommerce({...active,planEnabled:false},now),/offre/);
});
test('lifecycle changes do not count as creating a new order or product',()=>{
 const before=initialState(false);
 const next=structuredClone(before);
 assert.equal(isCommerceGrowth(before,next),false);
 next.products.push({id:'p',name:'Test',sku:'S',category:'General',variant:'',
   price:1000,cost:500,stock:1,threshold:0,color:'#ffffff',active:true});
 assert.equal(isCommerceGrowth(before,next),true);
 next.products=[];
 next.orders.push({id:'o',reference:'TC-1',customerId:'c',items:[],status:'TO_CONFIRM',
  source:'Manuel',subtotal:0,discount:0,shipping:0,deliveryCost:0,total:0,collected:0,
  carrier:'',tracking:'',notes:'',createdAt:now.toISOString(),updatedAt:now.toISOString(),callbackAt:'',events:[]});
 assert.equal(isCommerceGrowth(before,next),true);
});
