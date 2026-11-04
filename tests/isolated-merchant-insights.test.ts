import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {merchantInsights} from '../modules/shops/merchant-insights';
const now=new Date('2026-11-04T12:00:00Z');
test('deterministic owner-only insights show operational risks without exposing buyer PII',()=>{
 const s=initialState(false);
 s.products=[{id:'p',sku:'PRIVATE',name:'Article',category:'Général',variant:'',price:20000,cost:10000,
  stock:0,threshold:2,color:'#111111',active:true}];
 s.orders=[{id:'o',status:'CALLBACK',callbackAt:'2026-11-03T11:00:00Z',
  createdAt:'2026-11-02T12:00:00Z',customerSnapshot:{name:'SECRET',phone:'22123456',address:'PRIVATE STREET'}} as never];
 const report=merchantInsights(s,now);
 assert.equal(report.mode,'RULES_NOT_AI');
 assert.equal(report.summary.overdueCallbacks,1);
 assert.equal(report.summary.lowStockProducts,1);
 assert.equal(report.insights[0].id,'callbacks');
 for(const secret of ['SECRET','22123456','PRIVATE STREET','PRIVATE'])assert.equal(JSON.stringify(report).includes(secret),false);
});
test('empty shop gives bounded and non-alarming baseline',()=>{
 const report=merchantInsights(initialState(false),now);
 assert.equal(report.insights.length,1);
 assert.equal(report.insights[0].id,'ready');
 assert.equal(report.summary.ordersLast30Days,0);
});
test('rule engine never mutates finances or customer data',()=>{
 const s=initialState(false),before=JSON.stringify(s);
 const one=merchantInsights(s,now),two=merchantInsights(s,now);
 assert.deepEqual(one,two);
 assert.equal(JSON.stringify(s),before);
});

test('P4 actions navigate to allowlisted shop modules and omit buyer details',()=>{
 const s=initialState(false),now=new Date('2026-11-04T12:00:00Z');
 s.orders=[{id:'p1',reference:'TC-001',status:'SHIPPED',total:23000,collected:0,
  createdAt:'2026-11-03T10:00:00Z',updatedAt:'2026-11-03T12:00:00Z',
  customerSnapshot:{name:'BUYER PRIVATE',phone:'22123456',address:'PRIVATE STREET'},
  customerRequests:[{id:'r',type:'RETURN',status:'PENDING',reason:'VERY PRIVATE',at:'2026-11-03T10:00:00Z'}]} as never];
 const report=merchantInsights(s,now);
 assert.equal(report.mode,'RULES_NOT_AI');
 assert.equal(report.summary.pendingCustomerRequests,1);
 assert.equal(report.summary.missingHandoffs,1);
 assert.equal(report.insights.find(x=>x.id==='client-requests')?.targetTab,'callcenter');
 assert.equal(report.insights.find(x=>x.id==='handoffs')?.targetTab,'delivery');
 for(const insight of report.insights){
  assert.ok(['orders','catalog','callcenter','delivery','finance','growth'].includes(insight.targetTab));
  assert.ok(insight.actionLabel.length>=3);
 }
 for(const secret of ['BUYER PRIVATE','22123456','PRIVATE STREET','VERY PRIVATE'])
  assert.equal(JSON.stringify(report).includes(secret),false);
});
test('P4 audit insight counts more than 1000 delivered COD anomalies',()=>{
 const state=initialState(false);
 state.orders=Array.from({length:1103},(_,i)=>({
  id:'del-'+i,reference:'TC-'+i,status:'DELIVERED',carrier:'Transport',
  total:15000,collected:0,createdAt:'2026-11-01T10:00:00Z',
  updatedAt:'2026-11-02T10:00:00Z',customerRequests:[]
 })) as never;
 const report=merchantInsights(state,now);
 assert.equal(report.insights.find(x=>x.id==='cod-exceptions')?.metric,1103);
});
