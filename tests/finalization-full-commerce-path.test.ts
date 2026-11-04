import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {merchantInsights} from '../modules/shops/merchant-insights';
import {publicProductDetail} from '../modules/shops/public-product-detail';
import {merchantCouponsView} from '../modules/shops/merchant-coupons';
import {codAuditCsv,codAuditRows} from '../modules/shops/cod-exceptions';
import {carrierHandoffOverview} from '../modules/shops/carrier-handoffs';
import {projectTeamSection} from '../modules/shops/team-read';
import {parseCatalogCsv} from '../modules/commerce/catalog-import';

const staff='22222222-2222-4222-8222-222222222222';
const different='33333333-3333-4333-8333-333333333333';

test('full isolated commerce pilot: CSV, themed catalog, coupon, agent, fulfillment, carrier handoff and COD',()=>{
 const otherShop=initialState(false),otherBefore=JSON.stringify(otherShop);
 let state=initialState(false);
 const rows=parseCatalogCsv('sku;name;category;variant;priceTnd;costTnd;stock;threshold\n' +
 'SKU-A;Produit pilote;Mode;Noir;50.000;22.000;7;2\n');
 state=applyAction(state,'importProducts',{rows});
 state=applyAction(state,'saveStorefrontTheme',{theme:'SABLE'});
 const product=state.products[0];
 assert.equal(publicProductDetail(state,product.id)?.store.theme.code,'SABLE');
 state=applyAction(state,'coupon',{code:'PILOTE10',percent:10,limit:3});
 state=applyAction(state,'createOrder',{name:'Nom privé',phone:'22123456',city:'Gabès',
  address:'Adresse du client',source:'Boutique',items:[{productId:product.id,quantity:2}],coupon:'PILOTE10'});
 const id=state.orders[0].id,order=state.orders[0];
 assert.equal(order.subtotal,100000);
 assert.equal(order.discount,10000);
 assert.equal(order.total,90000+order.shipping);
 assert.equal(state.products[0].stock,5);
 assert.equal(merchantCouponsView(state).coupons[0].used,1);
 state=applyAction(state,'assignCallAgent',{id,agentId:staff});
 assert.equal((projectTeamSection(state,'CALL_CENTER','orders',different) as {orders:unknown[]}).orders.length,0);
 assert.equal((projectTeamSection(state,'CALL_CENTER','orders',staff) as {orders:unknown[]}).orders.length,1);
 assert.equal((projectTeamSection(state,'CALL_CENTER','orders') as {orders:unknown[]}).orders.length,0);
 state=applyAction(state,'note',{id,note:'Contact manuel · Téléphone · Réponse obtenue'});
 for(const status of ['CONFIRMED','PREPARING','READY'] as const)
  state=applyAction(state,'transition',{id,status});
 state=applyAction(state,'transition',{id,status:'SHIPPED',carrier:'Livreur pilote',tracking:'PILOT-123'});
 state=applyAction(state,'recordCarrierHandoff',{orderId:id,proofReference:'BON-SIGNE-PILOTE'});
 assert.equal(carrierHandoffOverview(state).pendingCount,0);
 state=applyAction(state,'transition',{id,status:'DELIVERED'});
 const total=state.orders[0].total;
 state=applyAction(state,'settlement',{id,amount:total,reference:'VERSEMENT-PILOTE'});
 state=applyAction(state,'recordCarrierStatement',{orderId:id,reference:'BORD-PILOTE',amount:total,date:'2026-11-04'});
 const settlementId=state.settlements[0].id,statementId=state.carrierStatements![0].id;
 state=applyAction(state,'reconcileCarrierStatement',{settlementId,statementId,proofReference:'CONTROLE-MANUEL-01'});
 assert.equal(state.orders[0].collected,total);
 assert.equal(state.settlements.length,1);
 assert.equal(state.carrierReconciliations?.length,1);
 assert.equal(codAuditRows(state)[0].outstandingGrossMillimes,0);
 const safeOutput=JSON.stringify({product:publicProductDetail(state,product.id),
  insights:merchantInsights(state),csv:codAuditCsv(codAuditRows(state))});
 for(const secret of ['22123456','Nom privé','Adresse du client','SKU-A','22000'])
  assert.equal(safeOutput.includes(secret),false);
 assert.equal(JSON.stringify(otherShop),otherBefore);
});
test('coupon revocation preserves history and prevents next discounted order',()=>{
 let state=initialState(false);
 state=applyAction(state,'importProducts',{rows:parseCatalogCsv('sku;name;category;variant;priceTnd;costTnd;stock;threshold\nA;Produit;Mode;;20.000;10.000;4;1\n')});
 state=applyAction(state,'coupon',{code:'TEST20',percent:20,limit:4});
 state=applyAction(state,'setCouponActive',{id:state.coupons[0].id,active:false});
 assert.equal(state.coupons[0].used,0);
 assert.throws(()=>applyAction(state,'createOrder',{name:'Client',phone:'22123456',city:'Gabès',
  address:'Adresse',source:'Boutique',items:[{productId:state.products[0].id,quantity:1}],coupon:'TEST20'}),/Coupon invalide/);
});
