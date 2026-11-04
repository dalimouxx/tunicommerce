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
