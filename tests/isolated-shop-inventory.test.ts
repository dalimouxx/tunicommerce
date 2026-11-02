import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {disallowLegacyProductMedia,enforcePilotProductCap,PILOT_MAX_PRODUCTS,inventoryMutation} from '../modules/shops/inventory';

test('inventory operations are limited to product and stock and a UUID request',()=>{
 assert.equal(inventoryMutation.safeParse({action:'reset',payload:{},requestId:'bad'}).success,false);
 assert.equal(inventoryMutation.safeParse({action:'stock',payload:{},requestId:'123e4567-e89b-42d3-a456-426614174000'}).success,true);
});
test('legacy media references cannot cross the shop boundary',()=>{
 assert.throws(()=>disallowLegacyProductMedia('product',{imageUrl:'/api/media/products/123e4567-e89b-42d3-a456-426614174000'}));
 assert.doesNotThrow(()=>disallowLegacyProductMedia('product',{imageUrl:'https://example.org/item.png'}));
});
test('pilot guard blocks over 20 products without deleting existing items',()=>{
 const old=initialState(false);
 const next=structuredClone(old);
 next.products=Array.from({length:PILOT_MAX_PRODUCTS+1},(_,i)=>({
  id:String(i),name:'Produit '+i,sku:'SKU'+i,category:'Test',variant:'',
  color:'#aabbcc',price:1000,cost:0,stock:1,threshold:0,active:true
 }));
 assert.throws(()=>enforcePilotProductCap(old,next));
 assert.equal(next.products.length,PILOT_MAX_PRODUCTS+1);
});
