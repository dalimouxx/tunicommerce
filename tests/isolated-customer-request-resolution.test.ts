import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {appendCustomerRequest} from '../modules/shops/public-customer-request';
import {publicTrackingView} from '../modules/shops/order-fulfillment';
import {orderMutation} from '../modules/shops/orders';

const token='11111111-1111-4111-8111-111111111111';
function fixture(){
 const state=initialState(false);
 state.products=[{id:'p',sku:'SKU',name:'Produit',category:'Tests',variant:'',
  price:15000,cost:1000,stock:3,threshold:1,color:'#ffffff',active:true}];
 const next=applyAction(state,'createOrder',{name:'Acheteur',phone:'22123456',city:'Gabès',
  address:'Adresse test',source:'Boutique',items:[{productId:'p',quantity:1}]});
 next.orders[0].publicReceiptId=token;
 return next;
}
test('P2/P3 owner resolves cancellation request and releases reserved stock exactly once',()=>{
 const initial=fixture();
 const requested=appendCustomerRequest(initial,token,{id:crypto.randomUUID(),
  type:'CANCEL',reason:'Demande annulation client'}).state;
 const order=requested.orders[0];
 const mutation={action:'resolveCustomerRequest',requestId:crypto.randomUUID(),payload:{
  orderId:order.id,requestId:order.customerRequests![0].id,status:'ACCEPTED',reply:'Annulation confirmée'
 }};
 assert.equal(orderMutation.safeParse(mutation).success,true);
 const processed=applyAction(requested,mutation.action,mutation.payload);
 assert.equal(processed.orders[0].status,'CANCELLED');
 assert.equal(processed.orders[0].customerRequests?.[0]?.status,'ACCEPTED');
 assert.equal(processed.products[0].stock,3);
 assert.equal(requested.products[0].stock,2);
 assert.throws(()=>applyAction(processed,mutation.action,mutation.payload),/déjà traitée/);
 assert.equal(publicTrackingView(processed,token)?.canCancel,false);
});
test('P3 accepted return only updates request, not refund or stock',()=>{
 let state=fixture();
 const id=state.orders[0].id;
 for(const status of ['CONFIRMED','PREPARING','READY'] as const)
  state=applyAction(state,'transition',{id,status});
 state=applyAction(state,'transition',{id,status:'SHIPPED',carrier:'Transport',tracking:'TRK'});
 state=applyAction(state,'transition',{id,status:'DELIVERED'});
 const req=crypto.randomUUID();
 state=appendCustomerRequest(state,token,{id:req,type:'RETURN',reason:'Produit abîmé'}).state;
 const processed=applyAction(state,'resolveCustomerRequest',{orderId:id,requestId:req,
  status:'ACCEPTED',reply:'Retour autorisé après inspection'});
 assert.equal(processed.orders[0].status,'DELIVERED');
 assert.equal(processed.orders[0].customerRequests?.[0]?.status,'ACCEPTED');
 assert.equal(processed.returns.length,0);
 assert.equal(processed.settlements.length,0);
 assert.equal(processed.products[0].stock,2);
});
