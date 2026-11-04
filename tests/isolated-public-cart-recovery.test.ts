import test from 'node:test';
import assert from 'node:assert/strict';
import {cartStorageKey,restoreCartQuantities,serializeCartQuantities,CART_TTL_MS} from '../modules/shops/public-cart-recovery';
const products=[{id:'p1',available:true},{id:'p2',available:false}];
const now=new Date('2026-11-04T12:00:00Z');
test('local cart restoration is scoped by shop and contains only product IDs and quantities',()=>{
 const raw=serializeCartQuantities({p1:2,p2:1},products,now);
 assert.ok(raw);
 assert.equal(raw!.includes('p2'),false);
 assert.deepEqual(restoreCartQuantities(raw!,products,now),{p1:2});
 assert.notEqual(cartStorageKey('boutique-a'),cartStorageKey('boutique-b'));
 for(const secret of ['phone','address','customer','email','name'])assert.equal(raw!.includes(secret),false);
});
test('expired/tampered cart does not restore and server remains checkout authority',()=>{
 const raw=serializeCartQuantities({p1:3},products,now)!;
 assert.deepEqual(restoreCartQuantities(raw,products,new Date(now.getTime()+CART_TTL_MS+1)),{});
 assert.deepEqual(restoreCartQuantities('{not JSON',products,now),{});
 assert.deepEqual(restoreCartQuantities(JSON.stringify({expiresAt:now.getTime()+1000,items:[{productId:'p1',quantity:100}]}),products,now),{});
 assert.deepEqual(restoreCartQuantities(JSON.stringify({expiresAt:now.getTime()+1000,items:[{productId:'p2',quantity:1}]}),products,now),{});
});
test('unavailable items cannot be reactivated by saved cart',()=>{
 const raw=serializeCartQuantities({p1:2},products,now)!;
 assert.deepEqual(restoreCartQuantities(raw,[{id:'p1',available:false}],now),{});
});
