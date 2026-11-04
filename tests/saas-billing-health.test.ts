import test from 'node:test';
import assert from 'node:assert/strict';
import {billingBucket,billingBuckets} from '../modules/platform/saas-billing-health';
const now=new Date('2026-11-04T10:00:00Z');
test('billing expiry pipeline prioritizes suspended, expiry and upcoming renewal',()=>{
 assert.equal(billingBucket({status:'SUSPENDED',endsAt:new Date('2027-01-01')},now),'SUSPENDED');
 assert.equal(billingBucket({status:'ACTIVE',endsAt:null},now),'EXPIRED');
 assert.equal(billingBucket({status:'TRIAL',endsAt:new Date('2026-11-09')},now),'DUE_SOON');
 assert.equal(billingBucket({status:'ACTIVE',endsAt:new Date('2026-12-09')},now),'VALID');
 assert.equal(billingBucket({status:'ACTIVE',endsAt:new Date('2026-10-09')},now),'EXPIRED');
});
test('billing indicators are separate categories, never implied payment',()=>{
 assert.deepEqual(billingBuckets([
  {status:'ACTIVE',endsAt:new Date('2027-01-01')},
  {status:'ACTIVE',endsAt:new Date('2026-11-05')},
  {status:'ACTIVE',endsAt:new Date('2026-10-31')},
  {status:'CANCELLED',endsAt:new Date('2027-01-01')}
 ],now),{VALID:1,DUE_SOON:1,EXPIRED:1,SUSPENDED:1});
});
