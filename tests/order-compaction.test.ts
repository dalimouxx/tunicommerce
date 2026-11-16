import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import type {State} from '../modules/commerce/types';
import {compactClosedOrders,COMPACTION_AGE_DAYS,COMPACTION_BATCH} from '../modules/commerce/compaction';
import {commercialOverview} from '../modules/shops/commercial-overview';
import {productProfitAnalytics} from '../modules/shops/product-profit-analytics';
import {isolatedCustomerDirectory} from '../modules/shops/customer-directory';
import {codBalances,codSettlementHistory} from '../modules/shops/cod-settlements';
import {carrierStatementsView} from '../modules/shops/carrier-statements';
import {merchantExceptionQueue} from '../modules/shops/merchant-exceptions';
import {codAuditRows} from '../modules/shops/cod-exceptions';
import {carrierCodReport} from '../modules/shops/carrier-cod-report';
import {merchantInsights} from '../modules/shops/merchant-insights';
import {compareCarriers} from '../modules/delivery/pricing';
import {customerTrust} from '../modules/customers/insights';
import {activityRecords} from '../modules/shops/activity-records';
import {deliveryOutcomes} from '../modules/reliability/policy';

const now=new Date('2026-11-16T12:00:00Z');
const shift=(iso:string,days:number)=>new Date(Date.parse(iso)-days*86400000).toISOString();
function shop(){
 let s=initialState(true);s.orders=[];for(const p of s.products)p.stock=10000;
 const cities=['Tunis','Sfax','Sousse'];
 for(let i=0;i<120;i++){
  s=applyAction(s,'createOrder',{name:'Client '+(i%20),phone:'2'+String(1000000+(i%20)).padStart(7,'0'),city:cities[i%3],address:'Rue numéro '+i+' quartier',source:'Boutique',items:[{productId:s.products[i%s.products.length].id,quantity:1+(i%2)}]});
  const id=s.orders[0].id;
  const path=i%10===0?['CANCELLED']:['CONFIRMED','PREPARING','READY','SHIPPED',i%7===0?'RETURNED':'DELIVERED'];
  for(const status of path)s=applyAction(s,'transition',{id,status,...(status==='SHIPPED'?{carrier:'Poste',tracking:'T'+i}:{})});
 }
 // Age most orders: two thirds become older than the threshold.
 s.orders.forEach((o,i)=>{const days=i%3===0?10:200;o.createdAt=shift(o.createdAt,days);o.updatedAt=shift(o.updatedAt,days);o.events=o.events.map(e=>({...e,at:shift(e.at,days)}));});
 return s;
}
const calculations=(s:State)=>JSON.stringify({
 overview:commercialOverview(s),profit:productProfitAnalytics(s),directory:isolatedCustomerDirectory(s),cod:codBalances(s),settlements:codSettlementHistory(s),
 statements:carrierStatementsView(s),exceptions:merchantExceptionQueue(s,now),audit:codAuditRows(s,now),carrierCod:carrierCodReport(s),insights:merchantInsights(s,now),
 carriers:compareCarriers(s,'Tunis'),trust:s.customers.map(c=>customerTrust(s,c.id)),outcomes:deliveryOutcomes(s),
 orders:s.orders.map(o=>[o.id,o.status,o.total,o.collected,o.subtotal,o.discount,o.shipping,o.items,o.customerSnapshot,o.carrier,o.tracking,o.createdAt,o.updatedAt])
},(_,v)=>typeof v==='bigint'?v.toString():v);

test('compaction keeps every business calculation identical',()=>{
 const before=shop();
 let current=before,rounds=0;
 for(;;){const result=compactClosedOrders(current,now);if(!result.archived.length)break;current=result.state;rounds++;}
 assert.ok(rounds>=2,'several batches were needed');
 const a=JSON.parse(calculations(current)),b=JSON.parse(calculations(before));
 for(const key of Object.keys(b))assert.deepEqual(a[key],b[key],'calcul différent : '+key);
 const searchBefore=activityRecords('shop',before).orders.map(({extra,...row})=>row),searchAfter=activityRecords('shop',current).orders.map(({extra,...row})=>row);
 assert.deepEqual(searchAfter,searchBefore,'search copy unchanged except detailed history');
 const compacted=current.orders.filter(o=>o.compactedAt),ids=new Set(compacted.map(o=>o.id));
 assert.ok(compacted.length>0);
 assert.ok(JSON.stringify(compacted).length<JSON.stringify(before.orders.filter(o=>ids.has(o.id))).length*0.75,'compacted orders are at least 25% lighter');
});
test('only old closed orders without open business are compacted, in bounded batches',()=>{
 const s=shop();
 const delivered=s.orders.filter(o=>o.status==='DELIVERED'&&Date.parse(o.updatedAt)<now.getTime()-COMPACTION_AGE_DAYS*86400000);
 const [withRequest,withDraft,withOpenReturn]=delivered;
 withRequest.customerRequests=[{id:'r1',type:'RETURN',reason:'Taille',at:withRequest.updatedAt,status:'PENDING'}] as never;
 s.invoices.push({id:'inv1',number:'',orderId:withDraft.id,status:'DRAFT'} as never);
 s.returns.push({id:'ret1',orderId:withOpenReturn.id,credit:10000,refunded:0} as never);
 const recent=s.orders.find(o=>Date.parse(o.updatedAt)>now.getTime()-30*86400000)!;
 const result=compactClosedOrders(s,now);
 assert.equal(COMPACTION_BATCH,50);
 assert.ok(result.archived.length<=COMPACTION_BATCH&&result.archived.length>0);
 const ids=new Set(result.archived.map(a=>a.orderId));
 for(const o of [withRequest,withDraft,withOpenReturn,recent])assert.ok(!ids.has(o.id),'not eligible: '+o.reference);
 const one=result.state.orders.find(o=>ids.has(o.id))!,original=s.orders.find(o=>o.id===one.id)!;
 assert.ok(one.events.length<=2&&one.events.length>=1);
 assert.deepEqual(one.events.at(-1),original.events.at(-1));
 assert.equal(one.riskSignals,undefined);assert.ok(one.compactedAt);
 const archive=result.archived.find(a=>a.orderId===one.id)!;
 assert.deepEqual(archive.events,original.events,'full history handed to the archive');
 assert.equal(s.orders.find(o=>o.id===one.id)!.events.length,original.events.length,'input not mutated');
});
test('an already compacted order that gets a new event is compacted again, and nothing else moves',()=>{
 let s=shop();
 for(;;){const r=compactClosedOrders(s,now);if(!r.archived.length)break;s=r.state;}
 assert.equal(compactClosedOrders(s,now).archived.length,0,'idempotent');
 const o=s.orders.find(x=>x.compactedAt)!;
 o.events.push({at:shift(now.toISOString(),120),label:'Note ajoutée plus tard'},{at:shift(now.toISOString(),119),label:'Autre note'});
 const again=compactClosedOrders(s,now);
 assert.deepEqual(again.archived.map(a=>a.orderId),[o.id]);
 assert.ok(again.state.orders.find(x=>x.id===o.id)!.events.length<=2);
});
