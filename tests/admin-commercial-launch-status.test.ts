import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialLaunchChecks,commercialLaunchStatus} from '../modules/platform/commercial-launch-status';

test('P5 global administrator defaults to NO-GO and never certifies itself',()=>{
 const report=commercialLaunchStatus({});
 assert.equal(report.total,7);
 assert.equal(report.declaredCount,0);
 assert.equal(report.allAttested,false);
 assert.equal(report.externallyCertified,false);
 assert.equal(new Set(report.rows.map(x=>x.key)).size,7);
});
test('P5 partial / forged env values are not accepted and secrets never returned',()=>{
 const key=commercialLaunchChecks[0].key;
 const result=commercialLaunchStatus({[key]:'TRUE',DATABASE_URL:'SECRET-FORBIDDEN',
  P5_LEGAL_FISCAL_APPROVED:'yes'});
 assert.equal(result.declaredCount,0);
 assert.equal(JSON.stringify(result).includes('SECRET-FORBIDDEN'),false);
 const approved=Object.fromEntries(commercialLaunchChecks.map(row=>[row.key,'true']));
 const all=commercialLaunchStatus({...approved,DATABASE_URL:'SENSITIVE'});
 assert.equal(all.allAttested,true);
 assert.equal(all.externallyCertified,false);
 assert.equal(JSON.stringify(all).includes('SENSITIVE'),false);
});
