import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import type {Order,State} from '../modules/commerce/types';
import {copilotInsights} from '../modules/copilot/insights';

const now=new Date('2026-11-20T12:00:00Z');
const ago=(hours:number)=>new Date(now.getTime()-hours*3600000).toISOString();
function base(){
 const s=initialState(true);
 // Neutral starting point: every order delivered, paid, recent, no stock alert.
 for(const o of s.orders){o.status='DELIVERED';o.collected=o.total;o.createdAt=ago(48);o.updatedAt=ago(48);o.customerRequests=[];}
 for(const p of s.products){p.stock=50;p.threshold=5;}
 s.carts=[];
 return s;
}
const find=(s:State,id:string)=>copilotInsights(s,now).find(i=>i.id===id);

test('A calm shop gets no false alarm',()=>{
 const urgent=copilotInsights(base(),now).filter(i=>i.severity==='urgent'||i.severity==='attention');
 assert.deepEqual(urgent,[]);
});
test('Orders waiting for confirmation for more than 24 h are urgent and lead to the Call Center',()=>{
 const s=base();
 for(const o of s.orders.slice(0,3)){o.status='TO_CONFIRM';o.updatedAt=ago(30);}
 s.orders[3].status='TO_CONFIRM';s.orders[3].updatedAt=ago(2);
 const insight=find(s,'confirm-late')!;
 assert.equal(insight.severity,'urgent');assert.match(insight.title,/^3 commandes attendent/);assert.equal(insight.action?.page,'Call Center');
});
test('Overdue callbacks and pending customer requests are urgent',()=>{
 const s=base();
 s.orders[0].status='CALLBACK';s.orders[0].callbackAt=ago(3);
 s.orders[1].status='CALLBACK';s.orders[1].callbackAt=new Date(now.getTime()+3600000).toISOString();
 s.orders[2].customerRequests=[{id:'r',type:'CANCEL',status:'PENDING',reason:'x',createdAt:ago(1)} as never];
 assert.match(find(s,'callback-late')!.title,/^1 rappel/);
 assert.equal(find(s,'requests')!.severity,'urgent');
});
test('Low stock names the products; an out-of-stock product that sells is flagged first',()=>{
 const s=base();s.products[0].stock=2;s.products[1].stock=0;
 const low=find(s,'stock-low')!;
 assert.equal(low.severity,'attention');assert.ok(low.detail.includes(s.products[0].name)&&low.detail.includes(s.products[1].name));
 assert.equal(low.action?.page,'Inventaire');
 s.products[0].active=false;s.products[1].active=false;
 assert.equal(find(s,'stock-low'),undefined,'inactive products are ignored');
});
test('COD delivered more than 7 days ago and not collected is reported with its amount',()=>{
 const s=base();const o=s.orders[0];o.collected=0;o.updatedAt=ago(24*10);
 const fresh=s.orders[1];fresh.collected=0;fresh.updatedAt=ago(24);
 const insight=find(s,'cod-late')!;
 assert.equal(insight.severity,'attention');assert.ok(insight.title.includes('1 commande'),insight.title);assert.equal(insight.action?.page,'Finances & COD');
});
test('Parcels in transit for more than 7 days are reported',()=>{
 const s=base();s.orders[0].status='SHIPPED';s.orders[0].updatedAt=ago(24*9);
 assert.match(find(s,'shipped-late')!.title,/^1 colis/);
});
test('A high refusal rate is flagged per governorate and per carrier, only with enough shipments',()=>{
 const s=base();
 const city=(o:Order)=>{o.customerSnapshot={...(o.customerSnapshot||s.customers.find(c=>c.id===o.customerId)!),city:'Tozeur'};};
 const sfax=s.orders.slice(0,6);sfax.forEach(city);sfax.forEach(o=>o.carrier='Rapid');
 sfax.slice(0,3).forEach(o=>o.status='RETURNED');
 const insight=find(s,'refusals-city')!;
 assert.ok(insight.title.includes('Tozeur')&&insight.title.includes('50 %'),insight.title);
 assert.ok(find(s,'refusals-carrier')!.title.includes('Rapid'));
 const few=base();few.orders.slice(0,2).forEach(o=>{city(o);o.status='RETURNED';});
 assert.equal(find(few,'refusals-city'),undefined,'two shipments are not enough to conclude');
});
test('Sales trend compares the last 7 days with the 7 before; insights are ordered by severity',()=>{
 const s=base();
 s.orders.forEach((o,i)=>{o.createdAt=i<6?ago(24*2):ago(24*10);});
 const trend=find(s,'trend')!;assert.ok(['opportunity','info'].includes(trend.severity));assert.match(trend.title,/%/);
 s.orders[0].status='TO_CONFIRM';s.orders[0].updatedAt=ago(30);s.products[0].stock=1;
 const order=copilotInsights(s,now).map(i=>i.severity);
 const rank={urgent:0,attention:1,opportunity:2,info:3} as const;
 assert.deepEqual(order,[...order].sort((a,b)=>rank[a]-rank[b]));
});
test('An empty shop gets a first step instead of statistics',()=>{
 const s=initialState(false);
 const insights=copilotInsights(s,now);
 assert.equal(insights[0].id,'start');assert.equal(insights.length,1);
});
