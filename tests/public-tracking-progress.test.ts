import test from 'node:test';
import assert from 'node:assert/strict';
import {publicTrackingProgress} from '../modules/shops/public-tracking-progress';

test('public tracking shows one current stage without inventing milestones',()=>{
 const statuses=['TO_CONFIRM','CALLBACK','NO_ANSWER','CONFIRMED','PREPARING',
  'READY','SHIPPED','DELIVERED'];
 for(const [expected,status] of statuses.entries()){
  const progress=publicTrackingProgress(status);
  assert.equal(progress.steps.length,6);
  assert.equal(progress.steps.filter(row=>row.state==='CURRENT').length,1);
  assert.equal(progress.steps.findIndex(row=>row.state==='CURRENT'),
   expected<3?0:expected-2);
  assert.equal(progress.steps.slice(0,expected<3?0:expected-2).every(row=>row.state==='DONE'),true);
 }
 assert.match(publicTrackingProgress('SHIPPED').note,/déclarée/);
 assert.match(publicTrackingProgress('DELIVERED').note,/sans validation automatique/);
});
test('cancellation, returned orders and unknown states never claim delivery/payment proof',()=>{
 const cancel=publicTrackingProgress('CANCELLED'),returned=publicTrackingProgress('RETURNED');
 assert.equal(cancel.steps.length,1);
 assert.equal(cancel.steps[0].id,'CANCELLED');
 assert.equal(returned.steps.length,1);
 assert.equal(returned.steps[0].id,'RETURNED');
 assert.equal(publicTrackingProgress('BANK_VERIFIED').steps.length,0);
 for(const text of [JSON.stringify(cancel),JSON.stringify(returned)]){
  assert.equal(text.includes('22123456'),false);
  assert.equal(text.includes('bankVerified'),false);
 }
});
