import test from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionReminderKind,subscriptionReminderMessage,subscriptionReminderChange} from '../modules/billing/reminder-policy';
const now=new Date('2026-11-12T12:00:00Z'),day=86_400_000;
test('Subscription reminders respect exact phase boundaries and ignore inactive accounts',()=>{
 for(const [offset,expected] of [[7*day+1,null],[7*day,'DUE_7'],[day+1,'DUE_7'],[day,'DUE_1'],[1,'DUE_1'],[0,'EXPIRED'],[-day+1,'EXPIRED'],[-day,null]] as const){
  assert.equal(subscriptionReminderKind('ACTIVE',new Date(now.getTime()+offset),now),expected);
  assert.equal(subscriptionReminderKind('TRIAL',new Date(now.getTime()+offset),now),expected);
 }
 for(const status of ['SUSPENDED','CANCELLED','EXPIRED','UNKNOWN'])assert.equal(subscriptionReminderKind(status,now,now),null);
 assert.equal(subscriptionReminderKind('ACTIVE',null,now),null);
 assert.equal(subscriptionReminderKind('ACTIVE',new Date(NaN),now),null);
});
test('Reminder text uses the account page, Tunis time and no automatic payment claim',()=>{
 const message=subscriptionReminderMessage('DUE_1',now,'https://tunicom.example');
 assert.ok(message.text.includes('13:00'));assert.ok(message.text.includes('https://tunicom.example/mon-abonnement'));
 assert.ok(message.text.includes('Aucun prélèvement automatique'));assert.ok(!message.subject.includes('\n'));
 assert.ok(subscriptionReminderMessage('EXPIRED',now,'https://tunicom.example').subject.includes('arrivé à échéance'));
});
test('Reminder preferences cannot supply another account or destination',()=>{
 assert.equal(subscriptionReminderChange.safeParse({enabled:true,expectedVersion:0}).success,true);
 for(const extra of [{ownerId:'other'},{workspaceId:'other'},{recipient:'other@example.test'},{expectedVersion:-1},{enabled:'true'}])
  assert.equal(subscriptionReminderChange.safeParse({enabled:true,expectedVersion:0,...extra}).success,false);
});
