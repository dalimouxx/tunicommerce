import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {portalRoleAllowed,portalLanding,portalSessionHash} from '../modules/auth/portal';
import {digest} from '../modules/auth/crypto';
test('Admin session hashes are independent from merchant session hashes',()=>{
 const token=randomBytes(32).toString('hex');
 assert.equal(portalSessionHash(token,'MERCHANT'),digest(token));
 assert.notEqual(portalSessionHash(token,'ADMIN'),portalSessionHash(token,'MERCHANT'));
 assert.equal(portalLanding('ADMIN'),'/admin');
 assert.equal(portalLanding('MERCHANT'),'/mes-boutiques');
});
test('Role-specific login rejects merchant credentials at super-admin portal',()=>{
 assert.equal(portalRoleAllowed('MERCHANT','ADMIN'),false);
 assert.equal(portalRoleAllowed('ADMIN','ADMIN'),true);
 assert.equal(portalRoleAllowed('MERCHANT','MERCHANT'),true);
 assert.equal(portalRoleAllowed('ADMIN','MERCHANT'),true);
 assert.equal(portalRoleAllowed('VIEWER','ADMIN'),false);
});
