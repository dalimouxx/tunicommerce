import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {normalizeState} from '../modules/commerce/normalize';
import {carrierHandoffInput,carrierHandoffOverview} from '../modules/shops/carrier-handoffs';

function fixture(){
 const state=initialState(false);
 state.products=[{id:'p',name:'Produit',sku:'A',category:'Mode',variant:'',price:50000,cost:30000,stock:4,threshold:1,color:'#777777',active:true}];
 let next=applyAction(state,'createOrder',{name:'Client privé',phone:'22123456',city:'Gabès',address:'Adresse secrète',source:'Boutique',items:[{productId:'p',quantity:1}]});
 const id=next.orders[0].id;
 for(const status of ['CONFIRMED','PREPARING','READY'] as const)next=applyAction(next,'transition',{id,status});
 return next;
}
test('handoff is recorded only after shipment with carrier and tracking',()=>{
 const ready=fixture(),orderId=ready.orders[0].id;
 assert.throws(()=>applyAction(ready,'recordCarrierHandoff',{orderId,proofReference:'BON-2026-001'}),/expédiée/);
 const shipped=applyAction(ready,'transition',{id:orderId,status:'SHIPPED',carrier:'Transport A',tracking:'TN-12345'});
 const next=applyAction(shipped,'recordCarrierHandoff',{orderId,proofReference:'BON-2026-001'});
 assert.equal(next.carrierHandoffs?.length,1);
 assert.equal(next.orders[0].status,'SHIPPED');
 assert.equal(next.orders[0].collected,0);
 assert.equal(next.settlements.length,0);
 assert.equal(shipped.carrierHandoffs?.length||0,0);
 assert.equal(carrierHandoffOverview(next).pendingCount,0);
 assert.equal(carrierHandoffOverview(next).receipts[0].tracking,'TN-12345');
 const output=JSON.stringify(carrierHandoffOverview(next));
 assert.equal(output.includes('22123456'),false);
 assert.equal(output.includes('Adresse secrète'),false);
 assert.throws(()=>applyAction(next,'recordCarrierHandoff',{orderId,proofReference:'BON-2026-002'}),/déjà enregistrée/);
});
test('handoff schema is strict and old states normalize without deleting history',()=>{
 const v={action:'recordCarrierHandoff',requestId:crypto.randomUUID(),payload:{orderId:crypto.randomUUID(),proofReference:'BON-2026-123'}};
 assert.equal(carrierHandoffInput.safeParse(v).success,true);
 assert.equal(carrierHandoffInput.safeParse({...v,payload:{...v.payload,bankVerified:true}}).success,false);
 const old=initialState(false);
 delete old.carrierHandoffs;
 assert.deepEqual(normalizeState(old).carrierHandoffs,[]);
});
