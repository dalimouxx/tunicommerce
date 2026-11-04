import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialLaunchControls,evaluateCommercialLaunch} from '../scripts/p5-commercial-readiness.mjs';

test('P5 launch is blocked by default, including missing and ambiguous approval values',()=>{
 const result=evaluateCommercialLaunch({});
 assert.equal(result.ready,false);
 assert.equal(result.confirmed,0);
 assert.equal(result.blocked.length,7);
 assert.equal(new Set(result.blocked.map(x=>x.key)).size,7);
 const almost=Object.fromEntries(commercialLaunchControls.map(x=>[x.key,'true']));
 almost.P5_BACKUP_RESTORE_VERIFIED='TRUE';
 assert.equal(evaluateCommercialLaunch(almost).ready,false);
 almost.P5_BACKUP_RESTORE_VERIFIED='true';
 almost.P5_LEGAL_FISCAL_APPROVED='yes';
 assert.equal(evaluateCommercialLaunch(almost).ready,false);
});
test('P5 all seven explicit attestations are required but never publish or access secrets',()=>{
 const approvals=Object.fromEntries(commercialLaunchControls.map(x=>[x.key,'true']));
 const result=evaluateCommercialLaunch({...approvals,DATABASE_URL:'secret',OTHER:'ignored'});
 assert.deepEqual({ready:result.ready,confirmed:result.confirmed,total:result.total},
  {ready:true,confirmed:7,total:7});
 assert.equal(JSON.stringify(result).includes('secret'),false);
 assert.equal(result.blocked.length,0);
});
