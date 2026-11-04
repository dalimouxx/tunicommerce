import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {codAuditRows,codAuditPage,parseCodAuditQuery,codAuditCsv} from '../modules/shops/cod-exceptions';

function fixture(){
 const state=initialState(false);
 state.products=[{id:'p',name:'Article',sku:'PRIVATE',category:'Général',variant:'',price:20000,cost:5000,
  stock:6,threshold:1,color:'#eeeeee',active:true}];
 const s=applyAction(state,'createOrder',{name:'Nom secret',phone:'22123456',city:'Gabès',
  address:'Rue privée',source:'Boutique',items:[{productId:'p',quantity:1}]});
 s.orders[0].status='DELIVERED';
 s.orders[0].carrier='Transport A';
 s.orders[0].updatedAt='2026-11-01T10:00:00Z';
 return s;
}
test('exports COD aging and mismatches, not private buyer or bank-verification claims',()=>{
 const start=fixture();
 const next=applyAction(start,'recordCarrierStatement',{orderId:start.orders[0].id,
  reference:'BORD-A',amount:12000,date:'2026-11-02'});
 const rows=codAuditRows(next,new Date('2026-11-04T12:00:00Z'));
 assert.equal(rows.length,1);
 assert.equal(rows[0].ageDays,3);
 assert.equal(rows[0].declaredMinusRegisteredMillimes,12000);
 assert.equal(rows[0].outstandingGrossMillimes,next.orders[0].total-next.orders[0].collected);
 assert.match(rows[0].attention,/Ecart/);
 const csv=codAuditCsv(rows);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.ok(csv.includes('12.000'));
 for(const secret of ['22123456','Rue privée','Nom secret','PRIVATE','bankVerified'])
  assert.equal(csv.includes(secret),false);
});
test('matched statements no longer show incomplete manual reconciliation',()=>{
 const s=fixture(),id=s.orders[0].id;
 let next=applyAction(s,'settlement',{id,amount:10000,reference:'REC-1'});
 next=applyAction(next,'recordCarrierStatement',{orderId:id,amount:10000,reference:'BORD-1',date:'2026-11-03'});
 const before=codAuditRows(next)[0];
 assert.match(before.attention,/Rapprochement incomplet/);
 next=applyAction(next,'reconcileCarrierStatement',{statementId:next.carrierStatements![0].id,
  settlementId:next.settlements[0].id,proofReference:'RELEVE-01'});
 const after=codAuditRows(next)[0];
 assert.equal(after.matchedManuallyMillimes,10000);
 assert.equal(after.declaredMinusRegisteredMillimes,0);
 assert.equal(after.attention.includes('Rapprochement incomplet'),false);
 assert.equal(after.registeredCodMillimes,10000);
});
test('spreadsheet CSV sanitizes fields controlled by external carriers',()=>{
 const state=fixture();
 state.orders[0].carrier='=HYPERLINK("bad")';
 const csv=codAuditCsv(codAuditRows(state));
 assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
});

test('P3 COD audit navigates beyond 1000 delivered orders and filters attention without PII',()=>{
 const state=fixture();
 const original=state.orders[0];
 state.orders=Array.from({length:1205},(_,i)=>({...original,id:'COD-'+i,reference:'TC-'+i,
  total:i%2?10000:20000,collected:i%2?10000:0}));
 const first=codAuditPage(state,{page:1,filter:'ALL'});
 const middle=codAuditPage(state,{page:10,filter:'ALL'});
 const last=codAuditPage(state,{page:13,filter:'ALL'});
 assert.deepEqual([first.rows.length,middle.rows.length,last.rows.length],[100,100,5]);
 assert.deepEqual([first.total,first.totalPages,first.attentionCount],[1205,13,1205]);
 assert.equal(new Set([...first.rows,...middle.rows,...last.rows].map(x=>x.reference)).size,205);
 assert.equal(codAuditPage(state,{page:1,filter:'ATTENTION'}).total,1205);
 assert.equal(codAuditPage(state,{page:1,filter:'CLEAN'}).total,0);
 assert.equal(codAuditRows(state).length,1000); // older callers preserve behavior
 assert.throws(()=>codAuditPage(state,{page:14,filter:'ALL'}),/introuvable/);
 const text=JSON.stringify({total:first.total,attention:first.attentionCount});
 for(const privateField of ['22123456','Rue privée','Nom secret'])assert.equal(text.includes(privateField),false);
});
test('P1/P3 COD export rejects unknown, ambiguous and overly large query arguments',()=>{
 assert.deepEqual(parseCodAuditQuery(new URLSearchParams('page=2&filter=ATTENTION&format=json')),
  {page:2,filter:'ATTENTION',format:'json'});
 for(const invalid of ['page=0','page=-1','page=12345','format=xml','filter=PAID',
  'filter=ALL&filter=CLEAN','page=1&page=2','redirect=https://evil.test']){
  assert.throws(()=>parseCodAuditQuery(new URLSearchParams(invalid)));
 }
});
