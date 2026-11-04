import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {normalizeState} from '../modules/commerce/normalize';
import {carrierHandoffInput,carrierHandoffOverview,parseHandoffPages,HANDOFF_PAGE_SIZE} from '../modules/shops/carrier-handoffs';

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

test('P3 supports all handoffs across independent bounded pending and history pages',()=>{
 const s=initialState(false);
 const date='2026-11-04T10:00:00Z';
 s.orders=Array.from({length:123},(_,index)=>({
  id:'order-'+index,reference:'TC-'+index,status:'SHIPPED',
  carrier:'Livreur test',tracking:'TEST-'+index,createdAt:date,
  customerSnapshot:{name:'Client confidentiel',phone:'22123456',address:'Adresse privée'}
 })) as never;
 s.carrierHandoffs=Array.from({length:77},(_,index)=>({
  id:'receipt-'+index,orderId:'order-'+index,carrier:'Livreur test',tracking:'TEST-'+index,
  proofReference:'BON-'+index+'-TEST',at:date
 }));
 const report=carrierHandoffOverview(s);
 assert.equal(report.pageSize,HANDOFF_PAGE_SIZE);
 assert.deepEqual([report.pendingCount,report.totalRecorded,report.pendingTotalPages,report.receiptsTotalPages],[46,77,2,2]);
 const last=carrierHandoffOverview(s,{pendingPage:2,receiptsPage:2});
 assert.deepEqual([report.pending.length,last.pending.length,report.receipts.length,last.receipts.length],[40,6,40,37]);
 assert.equal(new Set([...report.pending,...last.pending].map(row=>row.id)).size,46);
 assert.equal(new Set([...report.receipts,...last.receipts].map(row=>row.id)).size,77);
 assert.equal(JSON.stringify(last).includes('22123456'),false);
 assert.equal(JSON.stringify(report).includes('Adresse privée'),false);
 assert.throws(()=>carrierHandoffOverview(s,{pendingPage:3,receiptsPage:1}),/introuvable/);
});
test('P1/P3 handoff pages reject duplicate, unexpected and ambiguous query parameters',()=>{
 assert.deepEqual(parseHandoffPages(new URLSearchParams('pendingPage=2&receiptsPage=3')),
  {pendingPage:2,receiptsPage:3});
 for(const params of ['pendingPage=0','pendingPage=-1','pendingPage=10000',
  'receiptsPage=1&receiptsPage=2','pendingPage=1&pendingPage=1',
  'redirect=https://evil.example','receiptsPage=abc']){
  assert.throws(()=>parseHandoffPages(new URLSearchParams(params)));
 }
});
