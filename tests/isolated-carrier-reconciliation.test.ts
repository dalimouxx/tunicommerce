import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {normalizeState} from '../modules/commerce/normalize';
import {carrierStatementsView,carrierStatementMutation} from '../modules/shops/carrier-statements';

function fixture(){
 const s=initialState(false);
 s.products=[{id:'p',name:'Article',sku:'A1',category:'Général',variant:'',price:20000,cost:7000,
  stock:5,threshold:1,color:'#eeeeee',active:true}];
 const ordered=applyAction(s,'createOrder',{name:'Client',phone:'22123456',city:'Gabès',address:'Rue privée',
  source:'Boutique',items:[{productId:'p',quantity:1}]});
 ordered.orders[0].status='DELIVERED';ordered.orders[0].carrier='Livreur A';
 const orderId=ordered.orders[0].id;
 let next=applyAction(ordered,'settlement',{id:orderId,amount:10000,reference:'VIR-EXTERNE'});
 next=applyAction(next,'recordCarrierStatement',{orderId,amount:10000,reference:'BORD-001',date:'2026-11-03'});
 return next;
}
test('matching is strictly one-to-one, same order, equal amount and never records cash',()=>{
 const s=fixture(),statementId=s.carrierStatements![0].id,settlementId=s.settlements[0].id;
 const collected=s.orders[0].collected;
 const next=applyAction(s,'reconcileCarrierStatement',{statementId,settlementId,proofReference:'RELEVE-EXTERNE-12'});
 assert.equal(next.orders[0].collected,collected);
 assert.equal(next.settlements.length,s.settlements.length);
 assert.equal(next.carrierReconciliations?.length,1);
 assert.equal(s.carrierReconciliations?.length||0,0);
 const view=carrierStatementsView(next);
 assert.equal(view.summary.manuallyMatchedStatements,1);
 assert.equal(view.summary.pendingStatements,0);
 assert.equal(view.statements[0].manuallyMatched,true);
 assert.equal(view.orders[0].manuallyMatchedMillimes,10000);
 assert.throws(()=>applyAction(next,'reconcileCarrierStatement',{statementId,settlementId,proofReference:'RELEVE-EXTERNE-12'}),/déjà rapproché/);
});
test('amount mismatch and cross-order mismatch are rejected',()=>{
 const state=fixture();
 const statementId=state.carrierStatements![0].id,settlementId=state.settlements[0].id;
 state.settlements[0].amount=9000;
 assert.throws(()=>applyAction(state,'reconcileCarrierStatement',{statementId,settlementId,proofReference:'RELEVE-12345'}),/Montants différents/);
 state.settlements[0].amount=10000;
 state.settlements[0].orderId='other';
 assert.throws(()=>applyAction(state,'reconcileCarrierStatement',{statementId,settlementId,proofReference:'RELEVE-12345'}),/commandes différentes/);
});
test('strict schema and backwards-compatible normalization',()=>{
 const input={action:'reconcileCarrierStatement',requestId:crypto.randomUUID(),
  payload:{statementId:crypto.randomUUID(),settlementId:crypto.randomUUID(),proofReference:'EXT-123456'}};
 assert.equal(carrierStatementMutation.safeParse(input).success,true);
 assert.equal(carrierStatementMutation.safeParse({...input,payload:{...input.payload,approvedByBank:true}}).success,false);
 const s=initialState(false);
 delete s.carrierReconciliations;
 assert.deepEqual(normalizeState(s).carrierReconciliations,[]);
});
