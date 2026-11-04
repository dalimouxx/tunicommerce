import {pageOperationalQueue} from '../modules/shops/operational-queues';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {disallowLegacyProductMedia,inventoryMutation} from '../modules/shops/inventory';
import {assertMerchantAggregateQuotas} from '../modules/shops/aggregate-quotas';

test('inventory operations are limited to product and stock and a UUID request',()=>{
 assert.equal(inventoryMutation.safeParse({action:'reset',payload:{},requestId:'bad'}).success,false);
 assert.equal(inventoryMutation.safeParse({action:'stock',payload:{},requestId:'123e4567-e89b-42d3-a456-426614174000'}).success,true);
});
test('legacy media references cannot cross the shop boundary',()=>{
 assert.throws(()=>disallowLegacyProductMedia('product',{imageUrl:'/api/media/products/123e4567-e89b-42d3-a456-426614174000'}));
 assert.doesNotThrow(()=>disallowLegacyProductMedia('product',{imageUrl:'https://example.org/item.png'}));
});
test('product limits use plan and optional workspace override rather than a fixed pilot limit',()=>{
 const before=initialState(false);
 const next=structuredClone(before);
 next.products=Array.from({length:21},(_,i)=>({
  id:String(i),name:'Produit '+i,sku:'SKU'+i,category:'Test',variant:'',
  color:'#aabbcc',price:1000,cost:0,stock:1,threshold:0,active:true
 }));
 const basic={maxProducts:20,maxOrdersPerMonth:null,maxPhotos:30};
 assert.throws(()=>assertMerchantAggregateQuotas([],before,next,basic),/Limite|Plafond/);
 assert.doesNotThrow(()=>assertMerchantAggregateQuotas([],before,next,{...basic,maxProducts:100}));
 assert.doesNotThrow(()=>assertMerchantAggregateQuotas([],before,next,{...basic,maxProducts:null}));
 assert.equal(next.products.length,21);
});

test('P2 catalog pagination preserves all 155 products and last page',()=>{
 const products=Array.from({length:155},(_,i)=>({sku:'SKU-'+i,name:'Article '+i}));
 const pages=Array.from({length:4},(_,i)=>pageOperationalQueue(products,i+1,40));
 assert.deepEqual(pages.map(p=>p.items.length),[40,40,40,35]);
 assert.equal(new Set(pages.flatMap(p=>p.items.map(x=>x.sku))).size,155);
});
