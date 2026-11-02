import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {assertMerchantAggregateQuotas,merchantUsage} from '../modules/shops/aggregate-quotas';

const quota={maxProducts:2,maxOrdersPerMonth:2,maxPhotos:30};
function seeded(sku:string){
 return applyAction(initialState(false),'product',{
  name:'Produit '+sku,sku,category:'Mode',variant:'',price:40000,cost:12000,
  stock:10,threshold:1,color:'#aabbcc'
 });
}
function withOrder(state:ReturnType<typeof initialState>){
 return applyAction(state,'createOrder',{
  name:'Client',phone:'22123456',city:'Tunis',address:'Avenue principale',
  source:'Manuel',items:[{productId:state.products[0].id,quantity:1}]
 });
}
test('products count across legacy Workspace and other ShopCommerce records',()=>{
 const legacy=seeded('LEGACY');
 const other=seeded('SECOND');
 const before=initialState(false);
 const next=seeded('THIRD');
 assert.equal(merchantUsage([legacy,other]).products,2);
 assert.throws(()=>assertMerchantAggregateQuotas([legacy,other],before,next,quota),/Plafond global/);
 assert.doesNotThrow(()=>assertMerchantAggregateQuotas([legacy],before,next,quota));
});
test('orders count across all owned stores within Tunisia month',()=>{
 const legacy=withOrder(seeded('L'));
 const other=withOrder(seeded('S'));
 const before=seeded('N');
 const next=withOrder(before);
 assert.equal(merchantUsage([legacy,other]).ordersThisMonth,2);
 assert.throws(()=>assertMerchantAggregateQuotas([legacy,other],before,next,quota),/Plafond global/);
});
test('updates not increasing counted resources remain permitted when over limit',()=>{
 const original=seeded('A');
 const other=seeded('B');
 const extra=seeded('C');
 assert.doesNotThrow(()=>assertMerchantAggregateQuotas([other,extra],original,structuredClone(original),quota));
});
