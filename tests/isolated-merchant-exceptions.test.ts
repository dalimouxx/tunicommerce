import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {merchantExceptionQueue} from '../modules/shops/merchant-exceptions';
const now=new Date('2026-11-04T12:00:00.000Z');
test('stalled shipments, missing handoffs and open buyer requests are triaged without customer PII',()=>{
 const state=initialState(false);
 state.orders=[{
  id:'order-1',reference:'TC-101',status:'SHIPPED',
  updatedAt:'2026-10-27T12:00:00Z',createdAt:'2026-10-27T11:00:00Z',
  customerSnapshot:{name:'CLIENT SECRET',phone:'22123456',city:'Gabès',address:'RUE PRIVÉE'},
  customerRequests:[{id:'r1',type:'RETURN',status:'PENDING',at:'2026-11-01T12:00:00Z',reason:'PRIVATE'}]
 } as never];
 const result=merchantExceptionQueue(state,now);
 assert.equal(result.byKind.STALLED_SHIPMENT,1);
 assert.equal(result.byKind.HANDOFF_MISSING,1);
 assert.equal(result.byKind.CUSTOMER_REQUEST,1);
 assert.equal(result.total,3);
 for(const secret of ['CLIENT SECRET','22123456','RUE PRIVÉE','PRIVATE'])
  assert.equal(JSON.stringify(result).includes(secret),false);
});
test('handoff recorded suppresses duplicate reminder but not shipment-aging warning',()=>{
 const state=initialState(false);
 state.orders=[{id:'1',reference:'TC-102',status:'SHIPPED',
  createdAt:'2026-10-27T12:00:00Z',updatedAt:'2026-10-28T12:00:00Z'} as never];
 state.carrierHandoffs=[{id:'h',orderId:'1',carrier:'Carrier',tracking:'XX',proofReference:'BON-1',at:'2026-10-28T12:00:00Z'}];
 const result=merchantExceptionQueue(state,now);
 assert.equal(result.byKind.STALLED_SHIPMENT,1);
 assert.equal(result.byKind.HANDOFF_MISSING,0);
});
test('refund due is never presented as actual cash sent',()=>{
 const state=initialState(false);
 state.orders=[{id:'a',reference:'TC-103',status:'DELIVERED',carrier:'Carrier',total:10000,collected:10000,
  updatedAt:'2026-11-01T10:00:00Z'} as never];
 state.returns=[{id:'ret',reference:'RET-123',orderId:'a',productId:'p',quantity:1,reason:'Problème',
  condition:'DAMAGED',credit:8500,refunded:2000,returnCost:1000,
  createdAt:'2026-11-03T12:00:00Z',refunds:[]}];
 const result=merchantExceptionQueue(state,now);
 assert.equal(result.byKind.REFUND_DUE,1);
 assert.equal(result.items.find(x=>x.kind==='REFUND_DUE')?.amountMillimes,6500);
});

test('P3 livré : alertes bons manquants et COD ancien, sans preuve bancaire inventée',()=>{
 const state=initialState(false);
 state.orders=[{id:'delivered-1',reference:'TC-900',status:'DELIVERED',carrier:'Transport local',
  total:45000,collected:15000,updatedAt:'2026-10-30T12:00:00Z',createdAt:'2026-10-29T12:00:00Z',
  customerSnapshot:{name:'CLIENT SECRET',phone:'22123456',city:'Gabès',address:'RUE PRIVÉE'}} as never];
 const report=merchantExceptionQueue(state,now);
 assert.equal(report.byKind.DELIVERED_NO_HANDOFF,1);
 assert.equal(report.byKind.COD_OVERDUE,1);
 assert.equal(report.items.find(item=>item.kind==='COD_OVERDUE')?.amountMillimes,30000);
 const copy=structuredClone(state);
 copy.carrierHandoffs=[{id:'h1',orderId:'delivered-1',carrier:'Transport local',
  tracking:'T1',proofReference:'BON-1234',at:'2026-10-30T12:00:00Z'}];
 copy.orders[0].collected=45000;
 const resolved=merchantExceptionQueue(copy,now);
 assert.equal(resolved.byKind.DELIVERED_NO_HANDOFF,0);
 assert.equal(resolved.byKind.COD_OVERDUE,0);
 for(const secret of ['CLIENT SECRET','22123456','RUE PRIVÉE'])
  assert.equal(JSON.stringify(report).includes(secret),false);
});
