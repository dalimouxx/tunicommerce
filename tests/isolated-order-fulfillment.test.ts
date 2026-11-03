import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {fulfillmentQueue,publicTrackingView} from '../modules/shops/order-fulfillment';

const token='11111111-1111-4111-8111-111111111111';
function stateWithOrder(){
 const state=initialState(false);
 state.products=[{id:'p1',name:'Chaussures',sku:'PRIVATE',category:'Mode',variant:'Noir',
  price:25000,cost:15000,stock:3,threshold:1,color:'#000000',active:true}];
 const next=applyAction(state,'createOrder',{name:'Nom secret',phone:'22123456',
  city:'Gabès',address:'Adresse confidentielle',source:'Boutique',items:[{productId:'p1',quantity:1}]});
 next.orders[0].publicReceiptId=token;
 return next;
}
test('public tracking is secret-token gated, scoped and excludes personal/internal fields',()=>{
 const state=stateWithOrder();
 assert.equal(publicTrackingView(state,'22222222-2222-4222-8222-222222222222'),null);
 assert.equal(publicTrackingView(state,'invalid'),null);
 const view=publicTrackingView(state,token);
 assert.equal(view?.status,'TO_CONFIRM');
 assert.equal(view?.items[0].name,'Chaussures');
 const serialized=JSON.stringify(view);
 for(const secret of ['Nom secret','22123456','Adresse confidentielle','PRIVATE',
  'cost','customer','events','notes','riskSignals','publicReceiptId'])assert.equal(serialized.includes(secret),false);
});
test('fulfillment queue only includes confirmed, preparation, ready and shipped orders',()=>{
 const items=[
  {id:'shipped',status:'SHIPPED',createdAt:'2026-11-03T12:00:00Z'},
  {id:'pending',status:'TO_CONFIRM',createdAt:'2026-11-03T12:00:00Z'},
  {id:'ready',status:'READY',createdAt:'2026-11-03T12:00:00Z'},
  {id:'confirmed',status:'CONFIRMED',createdAt:'2026-11-03T12:00:00Z'},
  {id:'preparing',status:'PREPARING',createdAt:'2026-11-03T12:00:00Z'}
 ];
 assert.deepEqual(fulfillmentQueue(items).map(item=>item.id),['confirmed','preparing','ready','shipped']);
});
test('transition workflow can move to preparation then ready then shipped with carrier',()=>{
 let state=stateWithOrder();
 state=applyAction(state,'transition',{id:state.orders[0].id,status:'CONFIRMED'});
 state=applyAction(state,'transition',{id:state.orders[0].id,status:'PREPARING'});
 state=applyAction(state,'transition',{id:state.orders[0].id,status:'READY'});
 assert.equal(publicTrackingView(state,token)?.status,'READY');
 state=applyAction(state,'transition',{id:state.orders[0].id,status:'SHIPPED',carrier:'Livraison locale',tracking:'TRK-01'});
 assert.equal(publicTrackingView(state,token)?.tracking,'TRK-01');
});
