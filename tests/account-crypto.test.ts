import test from 'node:test';
import assert from 'node:assert/strict';
import {seal,open,encryptionConfigured} from '../modules/security/envelope';
import {totpCode,base32,matchingTotpStep} from '../modules/auth/totp';
import {emailConfigured} from '../modules/messaging/email';

test('protected account/job payloads are authenticated, randomized and bound to their context',()=>{
 process.env.APP_ENCRYPTION_SECRET='test-fixture-key-only-'.repeat(3);
 const value={email:'owner@example.test',token:'fixture-personal-link'};
 const a=seal(value,'job:a'),b=seal(value,'job:a');
 assert.notEqual(a,b);assert.equal(a.includes(value.token),false);
 assert.deepEqual(open(a,'job:a'),value);
 assert.throws(()=>open(a,'job:b'));
 const changed=JSON.parse(a);changed.tag=Buffer.alloc(16).toString('base64');
 assert.throws(()=>open(JSON.stringify(changed),'job:a'));
 process.env.APP_ENCRYPTION_SECRET='different-fixture-key-'.repeat(3);
 assert.throws(()=>open(a,'job:a'));
 delete process.env.APP_ENCRYPTION_SECRET;
 assert.equal(encryptionConfigured(),false);assert.throws(()=>seal(value,'job:a'));
});

test('TOTP follows RFC 6238 SHA-1 vectors and supports times beyond 2038',()=>{
 const key=Buffer.from('12345678901234567890');
 // RFC 6238 Appendix B: https://www.rfc-editor.org/rfc/rfc6238.html#appendix-B
 for(const [seconds,expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],
  [1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']] as const)
  assert.equal(totpCode(key,Math.floor(seconds/30),8),expected);
 assert.equal(base32(key),'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
 assert.equal(matchingTotpStep(key,'287082',59000),1);
 assert.equal(matchingTotpStep(key,'287082',120000),null);
 assert.equal(matchingTotpStep(key,'not-a-code',59000),null);
});

test('email availability requires deliberate SMTP and encryption configuration',()=>{
 const env={APP_ENCRYPTION_SECRET:'test-only-key-'.repeat(4),SMTP_HOST:'smtp.example.test',SMTP_PORT:'587',
  SMTP_USER:'test-only',SMTP_PASSWORD:'test-only',MAIL_FROM:'security@example.test'};
 assert.equal(emailConfigured(env),true);
 for(const field of Object.keys(env))assert.equal(emailConfigured({...env,[field]:''}),field==='SMTP_PORT');
 assert.equal(emailConfigured({...env,SMTP_PORT:'25'}),false);
 assert.equal(emailConfigured({...env,MAIL_FROM:'attacker\r\nBcc: x@example.test'}),false);
});
