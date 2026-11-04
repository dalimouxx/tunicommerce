import test from 'node:test';
import assert from 'node:assert/strict';
import {publicCodCheckoutInput,validatePublicCart,publicCheckoutReplay} from '../modules/shops/public-cod-checkout';
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

test('P1/P2 checkout retried after a lost response returns the original receipt',()=>{
 const state=initialState(false);
 state.products=[{id:'article',name:'Article',sku:'TEST',category:'Maison',variant:'',price:20000,
  cost:4000,stock:3,threshold:1,color:'#ffffff',active:true}];
 const accepted=applyAction(state,'createOrder',{name:'Client Test',phone:'22123456',city:'Tunis',
  address:'Avenue centrale',source:'Boutique',items:[{productId:'article',quantity:1}]});
 accepted.orders[0].publicReceiptId=valid.requestId;
 accepted.requests=[]; // request cache has rotated
 const payload=publicCodCheckoutInput.parse(valid);
 const result=publicCheckoutReplay(accepted,payload);
 assert.deepEqual(result,{accepted:true,alreadyApplied:true,reference:accepted.orders[0].reference,
  totalMillimes:accepted.orders[0].total,trackingToken:valid.requestId});
 assert.equal(publicCheckoutReplay(accepted,{...payload,requestId:crypto.randomUUID()}),null);
 assert.throws(()=>publicCheckoutReplay(accepted,{...valid,name:'Autre personne'}),/autre demande/);
 assert.throws(()=>publicCheckoutReplay(accepted,{...valid,items:[{productId:'article',quantity:2}]}),/autre demande/);
 assert.equal(publicCheckoutReplay(accepted,{...valid,phone:'+21622123456'})?.alreadyApplied,true);
 const legacy=initialState(false);
 legacy.requests=[valid.requestId];
 assert.throws(()=>publicCheckoutReplay(legacy,payload),/Reçu indisponible/);
});
