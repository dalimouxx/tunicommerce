import test from 'node:test';
import assert from 'node:assert/strict';
import {integrationReadiness} from '../modules/platform/integration-readiness';

test('unconfigured integrations are never described as connected',()=>{
 const rows=integrationReadiness({});
 assert.equal(rows.length,5);
 assert.ok(rows.every(r=>r.status==='NOT_CONFIGURED'&&!r.connected&&!r.verified));
});
test('credential presence is explicitly unverified and never leaks secret values',()=>{
 const secret='DO-NOT-LEAK-SECRET-123456';
 const rows=integrationReadiness({TUNICOMMERCE_CARRIER_API_BASE_URL:'https://carrier.example.invalid',
  TUNICOMMERCE_CARRIER_API_TOKEN:secret});
 const carrier=rows.find(r=>r.kind==='CARRIER')!;
 assert.equal(carrier.status,'CREDENTIALS_PRESENT_UNVERIFIED');
 assert.equal(carrier.connected,false);
 assert.equal(JSON.stringify(rows).includes(secret),false);
 assert.equal(JSON.stringify(rows).includes('carrier.example.invalid'),false);
});
test('partial configuration reports environment keys only',()=>{
 const row=integrationReadiness({TUNICOMMERCE_SMS_API_KEY:'abc'}).find(r=>r.kind==='SMS')!;
 assert.deepEqual(row.missingVariableNames,['TUNICOMMERCE_SMS_SENDER_ID']);
 assert.equal(row.status,'NOT_CONFIGURED');
});
