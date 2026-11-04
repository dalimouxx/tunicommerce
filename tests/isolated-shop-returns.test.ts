import {pageOperationalQueue} from '../modules/shops/operational-queues';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {isolatedReturnMutation,isolatedReturnsView} from '../modules/shops/isolated-returns';

function fixture(){
 const s=initialState(false);
 s.products=[{id:'p',sku:'PRIVATE',name:'Article',category:'Mode',variant:'',
  price:20000,cost:7000,stock:5,threshold:1,color:'#ffffff',active:true}];
 const ordered=applyAction(s,'createOrder',{name:'Client secret',phone:'22123456',
  city:'Gabès',address:'Adresse privée',source:'Boutique',items:[{productId:'p',quantity:2}]});
 ordered.orders[0].status='DELIVERED';
 return ordered;
}

test('receiveReturn restores resellable stock and tracks precise credit',()=>{
 const s=fixture();
 const next=applyAction(s,'receiveReturn',{orderId:s.orders[0].id,productId:'p',
  quantity:1,reason:'Taille incorrecte',condition:'RESELLABLE',returnCost:1000});
 assert.equal(s.returns.length,0);
 assert.equal(next.products[0].stock,4);
 assert.equal(next.returns[0].credit,20000);
 assert.equal(next.returns[0].refunded,0);
 assert.throws(()=>applyAction(next,'receiveReturn',{orderId:s.orders[0].id,productId:'p',
  quantity:2,reason:'Encore retour',condition:'RESELLABLE',returnCost:0}),/quantité dépasse/);
 const view=isolatedReturnsView(next);
 assert.equal(view.orders[0].items[0].returned,1);
 assert.equal(JSON.stringify(view).includes('22123456'),false);
});
test('refundReturn records partial reimbursement and rejects over-refund',()=>{
 const s=fixture();
 let next=applyAction(s,'receiveReturn',{orderId:s.orders[0].id,productId:'p',
  quantity:1,reason:'Article abîmé',condition:'DAMAGED',returnCost:500});
 next=applyAction(next,'refundReturn',{id:next.returns[0].id,amount:7000,reference:'R1'});
 assert.equal(next.returns[0].refunded,7000);
 assert.equal(next.returns[0].refunds[0].reference,'R1');
 assert.throws(()=>applyAction(next,'refundReturn',{id:next.returns[0].id,amount:15000,reference:'R2'}),/dépasse/);
});
test('strict mutations reject unallowed extra attributes',()=>{
 const input={action:'refundReturn',requestId:'55555555-5555-4555-8555-555555555555',payload:{
  id:'r',amount:1000,reference:'R'
 }};
 assert.equal(isolatedReturnMutation.safeParse(input).success,true);
 assert.equal(isolatedReturnMutation.safeParse({...input,payload:{...input.payload,admin:true}}).success,false);
 assert.equal(isolatedReturnMutation.safeParse({...input,action:'reset'}).success,false);
});

test('P2 full return history and outstanding refund filter remain pageable',()=>{
 const returns=Array.from({length:123},(_,i)=>({
  reference:'RET-'+i,credit:12000,refunded:i%2?12000:0
 }));
 const due=returns.filter(r=>r.credit>r.refunded);
 const page=pageOperationalQueue(returns,4,40);
 assert.equal(page.items.length,3);
 assert.equal(page.total,123);
 assert.equal(pageOperationalQueue(due,2,40).items.length,22);
 assert.equal(pageOperationalQueue(due,3,40).page,2);
});
