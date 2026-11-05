import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantCustomerRequestQueue,type MerchantCustomerRequestOrder} from '../modules/shops/customer-request-queue';

test('SAV pending queue gives access to every request beyond 50',()=>{
 const rows:MerchantCustomerRequestOrder[]=Array.from({length:127},(_,i)=>({
  id:'order-'+i,reference:'TC-'+i,status:'DELIVERED',
  customerRequests:[{id:'req-'+i,type:'RETURN',reason:'Retour soumis par le client',
   at:new Date(Date.UTC(2026,10,1)+i*60000).toISOString(),status:'PENDING'}]
 }));
 const views=Array.from({length:6},(_,i)=>merchantCustomerRequestQueue(rows,i+1).pending);
 assert.deepEqual(views.map(v=>v.items.length),[25,25,25,25,25,2]);
 assert.equal(views[0].items[0].request.id,'req-0');
 assert.equal(views[5].items[1].request.id,'req-126');
 assert.equal(new Set(views.flatMap(v=>v.items.map(x=>x.request.id))).size,127);
 assert.equal(merchantCustomerRequestQueue(rows,999).pending.page,6);
});
test('SAV decisions are pageable, with no automatic refund or stock mutation',()=>{
 const rows:MerchantCustomerRequestOrder[]=Array.from({length:136},(_,i)=>({
  id:'order-'+i,reference:'TC-'+i,status:'DELIVERED',
  customerRequests:[{id:'decision-'+i,type:'RETURN',reason:'Retour',
   at:new Date(Date.UTC(2026,10,1)+i*60000).toISOString(),status:'ACCEPTED',reply:'Accepté sous réserve'}]
 }));
 const original=structuredClone(rows);
 const pages=[1,2,3].map(page=>merchantCustomerRequestQueue(rows,1,page).history);
 assert.deepEqual(pages.map(v=>v.items.length),[50,50,36]);
 assert.equal(pages[0].items[0].request.id,'decision-135');
 assert.equal(new Set(pages.flatMap(v=>v.items.map(x=>x.request.id))).size,136);
 assert.deepEqual(rows,original);
 assert.equal(merchantCustomerRequestQueue(rows).pending.total,0);
});
