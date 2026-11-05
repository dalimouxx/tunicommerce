import test from 'node:test';
import assert from 'node:assert/strict';
import {portalLanding,portalRoleAllowed,portalSessionHash} from '../modules/auth/portal';
import {randomBytes} from 'node:crypto';

test('platform and merchant logins resolve to distinct locations and cookie identities',()=>{
 assert.notEqual(portalLanding('ADMIN'),portalLanding('MERCHANT'));
 const token=randomBytes(32).toString('hex');
 assert.notEqual(portalSessionHash(token,'ADMIN'),portalSessionHash(token,'MERCHANT'));
 assert.equal(portalRoleAllowed('MERCHANT','ADMIN'),false);
 assert.equal(portalRoleAllowed('ADMIN','ADMIN'),true);
});
