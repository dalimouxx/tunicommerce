import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentDirectoryQuery,paymentDirectoryPage,paymentDirectoryHref,PAYMENT_PAGE_SIZE} from '../modules/billing/payment-directory';

test('payment review defaults to pending across the entire database',()=>{
 assert.deepEqual(paymentDirectoryQuery({}).where,{status:'PENDING'});
 const query=paymentDirectoryQuery({status:'APPROVED',method:'D17',recherche:'  =A&B  '});
 assert.equal(query.where.status,'APPROVED');
 assert.equal(query.where.method,'D17');
 assert.equal(query.search,'=A&B');
 assert.ok(JSON.stringify(query.where).includes('transferReference'));
 assert.ok(JSON.stringify(query.where).includes('email'));
 assert.deepEqual(paymentDirectoryQuery({status:'ALL'}).where,{});
});

test('pagination and CSV retain all filters and clamp excessive offsets',()=>{
 const query=paymentDirectoryQuery({status:'REJECTED',method:'CASH',recherche:'A&B'});
 for(const path of ['/admin/paiements','/api/admin/subscription-payments/export']){
  const url=new URL(paymentDirectoryHref(path,query,5),'https://example.test');
  const restored=paymentDirectoryQuery(Object.fromEntries(url.searchParams));
  assert.deepEqual(restored.where,query.where);
  assert.equal(restored.page,5);
 }
 assert.equal(PAYMENT_PAGE_SIZE,50);
 assert.deepEqual(paymentDirectoryPage(999,205),{page:5,pages:5});
 assert.deepEqual(paymentDirectoryPage(1,0),{page:1,pages:1});
 for(const page of ['0','-1','1.5','1e5','9999999999','<script>'])
  assert.equal(paymentDirectoryQuery({page}).page,1);
 assert.equal(paymentDirectoryQuery({recherche:'x'.repeat(200)}).search.length,100);
 assert.equal(paymentDirectoryQuery({status:'invalid',method:'invalid'}).status,'PENDING');
});
