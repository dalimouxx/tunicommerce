import test from 'node:test';
import assert from 'node:assert/strict';
import {orderStatusCounts} from '../modules/shops/commercial-overview';

test('counts only recognized operational states in fixed buckets',()=>{
 const input=['TO_CONFIRM','CALLBACK','NO_ANSWER','CONFIRMED','PREPARING','READY','SHIPPED','DELIVERED','CANCELLED','RETURNED','UNKNOWN'];
 assert.deepEqual(orderStatusCounts(input),{
  toConfirm:3,confirmed:1,preparing:2,shipped:1,delivered:1,cancelled:1,returned:1
 });
});
test('empty shop has zero counts and does not reveal order details',()=>{
 assert.deepEqual(Object.values(orderStatusCounts([])),[0,0,0,0,0,0,0]);
 assert.equal(Object.hasOwn(orderStatusCounts(['TO_CONFIRM']),'customer'),false);
});
