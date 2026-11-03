import test from 'node:test';
import assert from 'node:assert/strict';
import {publicCodCheckoutInput,validatePublicCart} from '../modules/shops/public-cod-checkout';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';

const valid={requestId:'11111111-1111-4111-8111-111111111111',name:'Client Test',phone:'22123456',city:'Tunis',
 address:'Avenue centrale',items:[{productId:'article',quantity:1}]};

test('COD checkout strictly validates Tunisia customer and cart',()=>{
 const parsed=publicCodCheckoutInput.parse(valid);
 assert.doesNotThrow(()=>validatePublicCart(parsed));
 assert.equal(publicCodCheckoutInput.safeParse({...valid,phone:'00123456'}).success,false);
 assert.equal(publicCodCheckoutInput.safeParse({...valid,items:[{productId:'article',quantity:0}]}).success,false);
 assert.equal(publicCodCheckoutInput.safeParse({...valid,price:1}).success,false);
 const duplicated=publicCodCheckoutInput.parse({...valid,items:[{productId:'article',quantity:1},{productId:'article',quantity:1}]});
 assert.throws(()=>validatePublicCart(duplicated),/double/);
});
test('business order engine reserves stock and creates TO_CONFIRM with no payment',()=>{
 const state=initialState(false);
 state.products=[{id:'article',name:'Article',sku:'P1',category:'Maison',variant:'',price:12000,cost:3000,stock:3,threshold:1,color:'#ffffff',active:true}];
 const next=applyAction(state,'createOrder',{name:'Client Test',phone:'22123456',city:'Tunis',address:'Rue Test',
  source:'Boutique',items:[{productId:'article',quantity:2}]});
 assert.equal(next.products[0].stock,1);
 assert.equal(state.products[0].stock,3);
 assert.equal(next.orders[0].status,'TO_CONFIRM');
 assert.equal(next.orders[0].collected,0);
 assert.equal(next.orders[0].source,'Boutique');
 assert.throws(()=>applyAction(next,'createOrder',{name:'Client Test',phone:'22123456',city:'Tunis',address:'Rue Test',
  source:'Boutique',items:[{productId:'article',quantity:2}]}),/Stock insuffisant/);
});
