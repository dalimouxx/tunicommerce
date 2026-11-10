import test from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionRenewalPeriod} from '../modules/billing/renewal';
import {subscriptionDecisionInput} from '../modules/billing/validation';
const now=new Date('2026-11-10T10:00:00Z');
const account={plan:'PRO',subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date('2026-11-20T10:00:00Z')};

test('renewal preserves valid days and starts expired or undated accounts now',()=>{
 const period=subscriptionRenewalPeriod(account,30,now);
 assert.equal(period.startAt.toISOString(),'2026-11-20T10:00:00.000Z');
 assert.equal(period.endsAt.toISOString(),'2026-12-20T10:00:00.000Z');
 for(const expiry of [null,now,new Date('2020-01-01')]){
  const result=subscriptionRenewalPeriod({...account,subscriptionEndsAt:expiry},15,now);
  assert.equal(result.startAt.getTime(),now.getTime());
  assert.equal(result.endsAt.getTime(),now.getTime()+15*86400000);
 }
 assert.equal(subscriptionRenewalPeriod({...account,subscriptionStatus:'TRIAL'},1,now).startAt.getTime(),account.subscriptionEndsAt.getTime());
});

test('payment cannot silently reactivate a suspended or cancelled account',()=>{
 for(const subscriptionStatus of ['SUSPENDED','CANCELLED'])
  assert.throws(()=>subscriptionRenewalPeriod({...account,subscriptionStatus},30,now),{status:409});
 assert.equal(subscriptionRenewalPeriod({...account,subscriptionStatus:'UNKNOWN'},30,now).startAt.getTime(),now.getTime());
 for(const duration of [0,-1,1.5,3651,NaN,Infinity])
  assert.throws(()=>subscriptionRenewalPeriod(account,duration,now),{status:409});
});

test('approval requires explicit receipt confirmation and a verification note on the server',()=>{
 const base={id:'11111111-1111-4111-8111-111111111111',action:'approve',adminNote:'Relevé et montant contrôlés'};
 for(const receivedConfirmed of [undefined,false,'true',1])
  assert.equal(subscriptionDecisionInput.safeParse({...base,receivedConfirmed}).success,false);
 assert.equal(subscriptionDecisionInput.safeParse({...base,receivedConfirmed:true}).success,true);
 assert.equal(subscriptionDecisionInput.safeParse({...base,receivedConfirmed:true,adminNote:'   '}).success,false);
 assert.equal(subscriptionDecisionInput.safeParse({...base,action:'reject',adminNote:'Référence introuvable'}).success,true);
 assert.equal(subscriptionDecisionInput.safeParse({...base,action:'reject',adminNote:''}).success,false);
});
