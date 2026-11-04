import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {appendCustomerRequest,isolatedCustomerRequestInput} from '../modules/shops/public-customer-request';
import {publicTrackingView} from '../modules/shops/order-fulfillment';

const token='11111111-1111-4111-8111-111111111111';
function fixture(){
 const state=initialState(false);
 state.products=[{id:'p',sku:'SKU',name:'Article',category:'Mode',variant:'',price:15000,cost:2000,
  stock:2,threshold:1,color:'#ffffff',active:true}];
 const next=applyAction(state,'createOrder',{name:'CLIENT PRIVE',phone:'22123456',city:'Gabès',
  address:'RUE PRIVEE',source:'Boutique',items:[{productId:'p',quantity:1}]});
 next.orders[0].publicReceiptId=token;
 return next;
}
test('P2/P3 customer cancellation request is pending and never cancels stock automatically',()=>{
 const before=fixture(),id=crypto.randomUUID();
 const request={id,type:'CANCEL' as const,reason:'Je veux annuler la livraison'};
 const result=appendCustomerRequest(before,token,request);
 assert.equal(result.alreadyApplied,false);
 assert.equal(result.state.orders[0].status,'TO_CONFIRM');
 assert.equal(result.state.products[0].stock,1);
 assert.equal(before.orders[0].customerRequests?.length||0,0);
 assert.equal(result.state.orders[0].customerRequests?.[0]?.status,'PENDING');
 const replay=appendCustomerRequest(result.state,token,request);
 assert.equal(replay.alreadyApplied,true);
 assert.equal(replay.state.orders[0].customerRequests?.length,1);
 assert.throws(()=>appendCustomerRequest(result.state,token,{...request,reason:'Autre motif'}),/déjà utilisé/);
 assert.throws(()=>appendCustomerRequest(result.state,token,{...request,id:crypto.randomUUID()}),/déjà en attente/);
 const view=publicTrackingView(result.state,token);
 assert.ok(view);
 assert.equal(view?.canCancel,false);
 const publicJson=JSON.stringify(view);
 for(const text of ['CLIENT PRIVE','22123456','RUE PRIVEE','Je veux annuler la livraison','SKU'])
  assert.equal(publicJson.includes(text),false);
});
test('P3 returns only after delivery, limit total requests, reject bad input',()=>{
 let state=fixture();
 const id=state.orders[0].id;
 assert.throws(()=>appendCustomerRequest(state,token,{id:crypto.randomUUID(),type:'RETURN',
  reason:'Produit cassé'}),/impossible/);
 for(const status of ['CONFIRMED','PREPARING','READY'] as const)
  state=applyAction(state,'transition',{id,status});
 state=applyAction(state,'transition',{id,status:'SHIPPED',carrier:'Livreur',tracking:'TEST-1'});
 state=applyAction(state,'transition',{id,status:'DELIVERED'});
 assert.equal(publicTrackingView(state,token)?.canReturn,true);
 const requested=appendCustomerRequest(state,token,{id:crypto.randomUUID(),
  type:'RETURN',reason:'Article abîmé'});
 assert.equal(requested.state.orders[0].status,'DELIVERED');
 assert.equal(requested.state.orders[0].collected,0);
 assert.equal(publicTrackingView(requested.state,token)?.canReturn,false);
 assert.equal(isolatedCustomerRequestInput.safeParse({id:crypto.randomUUID(),
  type:'RETURN',reason:'x'}).success,false);
 assert.equal(isolatedCustomerRequestInput.safeParse({id:crypto.randomUUID(),
  type:'RETURN',reason:'Motif correct',bankVerified:true}).success,false);
});
