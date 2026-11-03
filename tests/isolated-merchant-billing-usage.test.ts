import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {merchantQuotaUsage} from '../modules/shops/billing-usage';

test('merchant quota usage combines legacy + independent shops and respects limits',()=>{
 const legacy=initialState(false),shop1=initialState(false),shop2=initialState(false);
 const product={id:'p',name:'Produit',sku:'S',category:'General',variant:'',price:1000,cost:100,stock:1,threshold:0,color:'#ffffff',active:true};
 legacy.products=[product];
 shop1.products=[{...product,id:'p2'}];
 shop2.products=[{...product,id:'p3'}];
 const usage=merchantQuotaUsage([legacy,shop1,shop2],{maxProducts:3,maxOrdersPerMonth:10},new Date('2026-11-03'));
 assert.equal(usage.products.used,3);
 assert.equal(usage.products.atLimit,true);
 assert.equal(usage.products.nearLimit,true);
 assert.equal(usage.orders.used,0);
});
test('unlimited quotas stay unlimited without misleading warnings',()=>{
 const usage=merchantQuotaUsage([initialState(false)],{maxProducts:null,maxOrdersPerMonth:null});
 assert.equal(usage.products.limit,null);
 assert.equal(usage.products.nearLimit,false);
 assert.equal(usage.orders.nearLimit,false);
});
