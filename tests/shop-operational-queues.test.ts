import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmationQueue,replenishmentQueue} from '../modules/shops/operational-queues';

test('callback due queue prioritizes overdue then new then unanswered and future scheduled',()=>{
 const now=new Date('2026-11-03T12:00:00.000Z');
 const orders=[
  {id:'future',status:'CALLBACK',callbackAt:'2026-11-04T12:00:00.000Z'},
  {id:'no-answer',status:'NO_ANSWER'},
  {id:'new',status:'TO_CONFIRM'},
  {id:'due',status:'CALLBACK',callbackAt:'2026-11-03T10:00:00.000Z'},
  {id:'delivered',status:'DELIVERED'}
 ];
 assert.deepEqual(confirmationQueue(orders,now).map(o=>o.id),['due','new','no-answer','future']);
 assert.equal(orders[0].status,'CALLBACK');
});
test('stock replenishment suggests minimum to get beyond threshold',()=>{
 const products=[
  {id:'healthy',active:true,stock:6,threshold:3},
  {id:'empty',active:true,stock:0,threshold:2},
  {id:'low',active:true,stock:2,threshold:2},
  {id:'inactive',active:false,stock:0,threshold:5}
 ];
 const rows=replenishmentQueue(products);
 assert.deepEqual(rows.map(r=>r.id),['empty','low']);
 assert.deepEqual(rows.map(r=>r.suggestedMinimum),[3,1]);
 assert.equal(rows[0].outOfStock,true);
});
