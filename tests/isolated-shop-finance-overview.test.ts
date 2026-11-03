import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {isolatedShopFinanceOverview} from '../modules/shops/finance-overview';

test('empty new shop has zero independent finance indicators',()=>{
 const view=isolatedShopFinanceOverview(initialState(false));
 assert.equal(view.deliveredGrossMillimes,0);
 assert.equal(view.collectedCodMillimes,0);
 assert.equal(view.outstandingCodMillimes,0);
 assert.equal(view.estimatedOperatingMarginMillimes,0);
});
test('isolated finance uses historical captured costs without mixing shops',()=>{
 const state=initialState(false);
 state.orders.push({
  id:'o1',reference:'SHOP-1',customerId:'c1',
  items:[{productId:'p1',name:'Article',variant:'',quantity:2,price:12000,cost:5000}],
  status:'DELIVERED',source:'Manuel',subtotal:24000,discount:0,shipping:6000,deliveryCost:3000,
  total:30000,collected:20000,carrier:'',tracking:'',notes:'',
  createdAt:'2026-11-03T10:00:00.000Z',updatedAt:'2026-11-03T10:00:00.000Z',callbackAt:'',events:[]
 });
 state.expenses.push({id:'e1',label:'Emballage',category:'Frais',amount:2000,date:'2026-11-03'});
 const v=isolatedShopFinanceOverview(state);
 assert.equal(v.deliveredGrossMillimes,30000);
 assert.equal(v.collectedCodMillimes,20000);
 assert.equal(v.outstandingCodMillimes,10000);
 assert.equal(v.costOfGoodsMillimes,10000);
 assert.equal(v.estimatedDeliveryCostMillimes,3000);
 assert.equal(v.estimatedOperatingMarginMillimes,15000);
 assert.equal(Object.hasOwn(v,'customer'),false);
});
