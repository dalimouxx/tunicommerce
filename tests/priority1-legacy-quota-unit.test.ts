import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {assertMerchantAggregateQuotas} from '../modules/shops/aggregate-quotas';

test('legacy and shops are counted as one product quota',()=>{
 const legacy=initialState(false);
 const shopA=initialState(false),shopB=initialState(false);
 const product={id:'p1',sku:'P1',name:'Article',category:'Mode',variant:'',
  price:10000,cost:5000,stock:1,threshold:1,color:'#ddd',active:true};
 shopA.products=[{...product}];
 shopB.products=[{...product,id:'p2',sku:'P2'}];
 const after=applyAction(legacy,'product',{name:'Troisième',sku:'P3',category:'Mode',
  variant:'',price:12000,cost:4000,stock:1,threshold:1,color:'#ddd'});
 assert.doesNotThrow(()=>assertMerchantAggregateQuotas([shopA,shopB],legacy,after,
  {maxProducts:3,maxOrdersPerMonth:10,maxPhotos:30}));
 assert.throws(()=>assertMerchantAggregateQuotas([shopA,shopB],legacy,after,
  {maxProducts:2,maxOrdersPerMonth:10,maxPhotos:30}),/Plafond global/);
});
