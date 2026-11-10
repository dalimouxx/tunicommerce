import test from 'node:test';
import assert from 'node:assert/strict';
import {financialReportQuery,previousFinancialReportQuery,financialReportWhere,financialReportHref,financialReportCsv,summarizeFinancialGroups,FinancialReportInputError,type FinancialGroup} from '../modules/billing/financial-report';

test('monthly boundaries use the Tunisian calendar, with an exclusive next-month boundary',()=>{
 const november=financialReportQuery({mois:'2026-11'});
 assert.equal(november.start.toISOString(),'2026-10-31T23:00:00.000Z');
 assert.equal(november.end.toISOString(),'2026-11-30T23:00:00.000Z');
 assert.equal(financialReportQuery({},new Date('2026-10-31T23:30:00Z')).month,'2026-11');
 const leap=financialReportQuery({mois:'2028-02'});
 assert.equal((leap.end.getTime()-leap.start.getTime())/86400000,29);
 assert.equal(financialReportQuery({mois:'2026-12'}).end.toISOString(),'2026-12-31T23:00:00.000Z');
 const previous=previousFinancialReportQuery(financialReportQuery({mois:'2020-01',offre:'PRO',method:'D17'}));
 assert.equal(previous.month,'2019-12');
 assert.equal(previous.plan,'PRO');assert.equal(previous.method,'D17');
 assert.equal(previous.end.toISOString(),'2019-12-31T23:00:00.000Z');
});

test('invalid finance filters fail explicitly instead of exporting a different period',()=>{
 for(const mois of ['2026-00','2026-13','2026-1','2019-01','2101-01','<script>',['2026-11']])
  assert.throws(()=>financialReportQuery({mois}),FinancialReportInputError);
 for(const offre of ['pro','X','A'.repeat(25),['PRO']])
  assert.throws(()=>financialReportQuery({offre}),FinancialReportInputError);
 assert.throws(()=>financialReportQuery({method:'CARD'}),FinancialReportInputError);
});

test('approved and rejected use decision dates while pending uses submission dates',()=>{
 const query=financialReportQuery({mois:'2026-11',offre:'PRO',method:'D17'});
 assert.deepEqual(financialReportWhere(query),{planCode:'PRO',method:'D17',OR:[
  {status:'APPROVED',decidedAt:{gte:query.start,lt:query.end}},
  {status:'REJECTED',decidedAt:{gte:query.start,lt:query.end}},
  {status:'PENDING',createdAt:{gte:query.start,lt:query.end}}
 ]});
 const url=new URL(financialReportHref('/api/admin/finances-saas/export',query),'https://test.local');
 const restored=financialReportQuery(Object.fromEntries(url.searchParams));
 assert.deepEqual(financialReportWhere(restored),financialReportWhere(query));
});

const group=(planCode:string,method:string,status:string,count:number,amount:number):FinancialGroup=>({
 planCode,method,status,_count:{_all:count},_sum:{priceMillimes:amount}
});
test('financial breakdowns reconcile without treating pending or refused amounts as validated',()=>{
 const summary=summarizeFinancialGroups([
  group('PRO','D17','APPROVED',2,69001),group('PRO','CASH','APPROVED',1,1000),
  group('STARTER','D17','PENDING',1,19000),group('PRO','D17','REJECTED',1,23000)
 ]);
 assert.deepEqual(summary.totals,{
  APPROVED:{count:3,millimes:70001},PENDING:{count:1,millimes:19000},REJECTED:{count:1,millimes:23000}
 });
 for(const rows of [summary.byPlan,summary.byMethod]){
  for(const status of ['APPROVED','PENDING','REJECTED'] as const){
   assert.equal(rows.reduce((n,row)=>n+row.totals[status].millimes,0),summary.totals[status].millimes);
   assert.equal(rows.reduce((n,row)=>n+row.totals[status].count,0),summary.totals[status].count);
  }
 }
 assert.equal(summarizeFinancialGroups([]).totals.APPROVED.millimes,0);
});

test('monthly CSV has one row per source group, exact millimes and formula protection',()=>{
 const groups=[group('PRO','D17','APPROVED',2,69001),group('=UNTRUSTED','CASH','PENDING',1,19000)];
 const csv=financialReportCsv(financialReportQuery({mois:'2026-11'}),groups);
 assert.equal(csv.startsWith('\uFEFF'),true);
 assert.equal(csv.trim().split('\r\n').length,3);
 assert.ok(csv.includes('"69.001"'));
 assert.ok(csv.includes('"\'=UNTRUSTED"'));
 assert.ok(csv.includes('"Décision"'));assert.ok(csv.includes('"Dépôt"'));
});
