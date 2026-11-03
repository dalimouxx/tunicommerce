import test from 'node:test';
import assert from 'node:assert/strict';
import {quotaOverview,subscriptionOverview} from '../modules/subscriptions/overview';

const now=new Date('2026-11-03T12:00:00.000Z');
test('subscription reporting never invents grace after exact expiry',()=>{
 const expired=subscriptionOverview('ACTIVE',new Date('2026-11-03T12:00:00.000Z'),now);
 assert.equal(expired.active,false);
 assert.equal(expired.expired,true);
 assert.equal(expired.daysRemaining,0);
 const future=subscriptionOverview('TRIAL',new Date('2026-11-04T11:00:00.000Z'),now);
 assert.equal(future.active,true);
 assert.equal(future.daysRemaining,1);
});
test('status alone never makes an undated or suspended subscription active',()=>{
 assert.equal(subscriptionOverview('ACTIVE',null,now).active,false);
 assert.equal(subscriptionOverview('SUSPENDED',new Date('2026-12-01'),now).active,false);
});
test('quotas account for unlimited and over-limit existing tenants without modifying them',()=>{
 assert.deepEqual(quotaOverview(4,null),{used:4,limit:null,remaining:null,atLimit:false});
 assert.deepEqual(quotaOverview(5,3),{used:5,limit:3,remaining:0,atLimit:true});
 assert.deepEqual(quotaOverview(2,3),{used:2,limit:3,remaining:1,atLimit:false});
});
