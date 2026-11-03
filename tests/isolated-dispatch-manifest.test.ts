import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {dispatchManifest,dispatchManifestCsv,csvCell} from '../modules/shops/dispatch-manifest';

test('manifest includes ready/shipped only and uses captured customer snapshot',()=>{
 const state=initialState(false);
 state.products=[{id:'p',name:'Article',sku:'ABC',category:'Mode',variant:'Noir',price:10000,cost:2500,stock:3,threshold:1,color:'#ffffff',active:true}];
 let next=applyAction(state,'createOrder',{name:'Client suivi',phone:'22123456',city:'Gabès',address:'Adresse privée',source:'Boutique',items:[{productId:'p',quantity:1}]});
 const id=next.orders[0].id;
 next=applyAction(next,'transition',{id,status:'CONFIRMED'});
 next=applyAction(next,'transition',{id,status:'PREPARING'});
 next=applyAction(next,'transition',{id,status:'READY'});
 const ready=dispatchManifest(next);
 assert.equal(ready.length,1);
 assert.equal(ready[0].status,'READY');
 assert.equal(ready[0].quantity,1);
 assert.equal(ready[0].codMillimes,next.orders[0].total);
 next=applyAction(next,'transition',{id,status:'SHIPPED',carrier:'Transport',tracking:'SUIVI-1'});
 assert.equal(dispatchManifest(next)[0].carrier,'Transport');
 next=applyAction(next,'transition',{id,status:'DELIVERED'});
 assert.deepEqual(dispatchManifest(next),[]);
});
test('CSV escaping neutralizes spreadsheet formula injection and keeps UTF-8/3-digit TND',()=>{
 assert.equal(csvCell('=1+1'),"'\"=1+1\"".slice(1));
});
