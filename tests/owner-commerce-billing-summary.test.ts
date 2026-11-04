import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {ownerCommerceBillingSummary} from '../modules/shops/merchant-billing-summary';
const now=new Date('2026-11-04T10:00:00Z');

test('owner billing sums legacy and isolated shop product/order usage',()=>{
 const a=initialState(false),b=initialState(false);
 a.products=[{id:'p',name:'A',sku:'A',category:'Général',variant:'',price:1000,cost:200,stock:1,threshold:1,color:'#111111',active:true}];
 b.products=[{id:'q',name:'B',sku:'B',category:'Général',variant:'',price:1000,cost:200,stock:1,threshold:1,color:'#111111',active:true}];
 a.orders=[{id:'one',createdAt:'2026-11-03T12:00:00Z'} as never];
 b.orders=[{id:'two',createdAt:'2026-11-04T12:00:00Z'} as never];
 const report=ownerCommerceBillingSummary([a,b],{maxProducts:2,maxOrdersPerMonth:4},
  {status:'ACTIVE',endsAt:new Date('2026-12-10')},now);
 assert.equal(report.products.used,2);
 assert.equal(report.products.atLimit,true);
 assert.equal(report.orders.used,2);
 assert.equal(report.orders.remaining,2);
 assert.equal(report.attention,null);
});
test('expiring and expired subscriptions show accurate attention',()=>{
 const states=[initialState(false)];
 const soon=ownerCommerceBillingSummary(states,{maxProducts:null,maxOrdersPerMonth:null},
  {status:'TRIAL',endsAt:new Date('2026-11-06')},now);
 assert.match(soon.attention||'',/échéance/);
 const expired=ownerCommerceBillingSummary(states,{maxProducts:null,maxOrdersPerMonth:null},
  {status:'ACTIVE',endsAt:new Date('2026-11-01')},now);
 assert.equal(expired.subscription.active,false);
 assert.match(expired.attention||'',/restreintes/);
});
