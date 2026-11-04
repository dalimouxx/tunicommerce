import test from 'node:test';
import assert from 'node:assert/strict';
import {independentBillingUpdate,assertIndependentBillingChange} from '../modules/platform/independent-billing-control';

const now=new Date('2026-11-04T10:00:00Z');
const base={shopId:'11111111-1111-4111-8111-111111111111',expectedPlan:'STARTER',expectedStatus:'ACTIVE',
 plan:'PRO',status:'ACTIVE' as const,reason:'Changement administratif contrôlé',acknowledgeManualChange:true as const};
test('admin changes plan without manipulating the paid period',()=>{
 const current={plan:'STARTER',subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date('2026-12-01')};
 const parsed=independentBillingUpdate.parse(base);
 assert.deepEqual(assertIndependentBillingChange(parsed,current,true,now),{plan:'PRO',subscriptionStatus:'ACTIVE'});
 assert.equal(current.plan,'STARTER');
 assert.equal(current.subscriptionEndsAt.toISOString().slice(0,10),'2026-12-01');
});
test('expired subscriptions cannot be reactivated without renewal verification',()=>{
 const parsed=independentBillingUpdate.parse({...base,expectedStatus:'SUSPENDED',plan:'STARTER',status:'ACTIVE'});
 assert.throws(()=>assertIndependentBillingChange(parsed,
 {plan:'STARTER',subscriptionStatus:'SUSPENDED',subscriptionEndsAt:new Date('2026-10-01')},true,now),/échéance/i);
});
test('manual status change rejects stale state and requires reason',()=>{
 assert.equal(independentBillingUpdate.safeParse({...base,reason:'court'}).success,false);
 assert.equal(independentBillingUpdate.safeParse({...base,acknowledgeManualChange:false}).success,false);
 const parsed=independentBillingUpdate.parse(base);
 assert.throws(()=>assertIndependentBillingChange(parsed,
 {plan:'PREMIUM',subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date('2026-12-01')},true,now),/modifié/);
});
