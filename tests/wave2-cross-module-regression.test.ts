import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {carrierHandoffOverview} from '../modules/shops/carrier-handoffs';
import {codAuditRows,codAuditCsv} from '../modules/shops/cod-exceptions';
import {callCenterWorkload} from '../modules/shops/call-center-workload';
import {carrierStatementsView} from '../modules/shops/carrier-statements';

const agentId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function shop(){
 const state=initialState(false);
 state.products=[{id:'p1',name:'Produit pilote',sku:'PILOT',category:'Essai',variant:'Standard',
  price:30000,cost:12000,stock:4,threshold:1,color:'#222222',active:true}];
 return state;
}
test('one order follows agent, carrier handoff, payment record and manual COD matching without double booking',()=>{
 const secondShop=shop(),otherBefore=JSON.stringify(secondShop);
 let state=shop();
 state=applyAction(state,'createOrder',{name:'Client pilote',phone:'22123456',city:'Gabès',
  address:'Rue du test',source:'Boutique',items:[{productId:'p1',quantity:1}]});
 const orderId=state.orders[0].id;
 assert.equal(state.products[0].stock,3);
 const unassigned=callCenterWorkload(state.orders,[{id:agentId,name:'Agent 1',role:'CALL_CENTER',active:true}]);
 assert.equal(unassigned.unassigned,1);
 state=applyAction(state,'assignCallAgent',{id:orderId,agentId});
 assert.equal(callCenterWorkload(state.orders,[{id:agentId,name:'Agent 1',role:'CALL_CENTER',active:true}]).agents[0].assigned,1);
 state=applyAction(state,'note',{id:orderId,note:'Contact manuel · Téléphone · Réponse obtenue'});
 for(const status of ['CONFIRMED','PREPARING','READY'] as const)
  state=applyAction(state,'transition',{id:orderId,status});
 assert.equal(state.orders[0].status,'READY');
 state=applyAction(state,'transition',{id:orderId,status:'SHIPPED',carrier:'Livreur test',tracking:'TRACK-TEST-01'});
 state=applyAction(state,'recordCarrierHandoff',{orderId,proofReference:'BON-SIGNE-TEST'});
 assert.equal(carrierHandoffOverview(state).pendingCount,0);
 assert.equal(carrierHandoffOverview(state).receipts[0].proofReference,'BON-SIGNE-TEST');
 state=applyAction(state,'transition',{id:orderId,status:'DELIVERED'});
 const total=state.orders[0].total;
 state=applyAction(state,'settlement',{id:orderId,amount:total,reference:'RELEVE-TEST-01'});
 state=applyAction(state,'recordCarrierStatement',{orderId,amount:total,reference:'BORD-TEST-01',date:'2026-11-04'});
 const before=carrierStatementsView(state);
 assert.equal(before.summary.pendingStatements,1);
 assert.equal(state.orders[0].collected,total);
 const settlementId=state.settlements[0].id,statementId=state.carrierStatements![0].id;
 state=applyAction(state,'reconcileCarrierStatement',{settlementId,statementId,proofReference:'VERIFICATION-MANUELLE-01'});
 const after=carrierStatementsView(state);
 assert.equal(after.summary.pendingStatements,0);
 assert.equal(after.orders[0].declarationGapMillimes,0);
 assert.equal(state.orders[0].collected,total);
 assert.equal(state.settlements.length,1);
 assert.equal(codAuditRows(state)[0].outstandingGrossMillimes,0);
 const csv=codAuditCsv(codAuditRows(state));
 assert.equal(csv.includes('22123456'),false);
 assert.equal(csv.includes('Rue du test'),false);
 assert.equal(csv.includes('Client pilote'),false);
 assert.equal(JSON.stringify(secondShop),otherBefore);
});
test('audit cannot be bypassed by duplicate handoff or duplicate manual COD matching',()=>{
 let state=shop();
 state=applyAction(state,'createOrder',{name:'Client 2',phone:'22123456',city:'Gabès',
  address:'Rue deux',source:'Boutique',items:[{productId:'p1',quantity:1}]});
 const id=state.orders[0].id;
 for(const status of ['CONFIRMED','PREPARING','READY'] as const)
  state=applyAction(state,'transition',{id,status});
 state=applyAction(state,'transition',{id,status:'SHIPPED',carrier:'Livreur test',tracking:'T2'});
 state=applyAction(state,'recordCarrierHandoff',{orderId:id,proofReference:'BON-TEST-02'});
 assert.throws(()=>applyAction(state,'recordCarrierHandoff',{orderId:id,proofReference:'BON-TEST-02'}),/déjà enregistrée/);
 state=applyAction(state,'transition',{id,status:'DELIVERED'});
 state=applyAction(state,'settlement',{id,amount:5000,reference:'PAIEMENT-02'});
 state=applyAction(state,'recordCarrierStatement',{orderId:id,amount:5000,reference:'BORD-02',date:'2026-11-04'});
 const payload={settlementId:state.settlements[0].id,statementId:state.carrierStatements![0].id,
  proofReference:'CONTROL-TEST-02'};
 const next=applyAction(state,'reconcileCarrierStatement',payload);
 assert.throws(()=>applyAction(next,'reconcileCarrierStatement',payload),/déjà rapproché/);
 assert.equal(next.settlements.length,1);
 assert.equal(next.orders[0].collected,5000);
});
