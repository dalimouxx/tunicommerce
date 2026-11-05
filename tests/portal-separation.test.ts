import test from 'node:test';
import assert from 'node:assert/strict';
import {portalRoleAllowed,portalLanding,portalSessionHash} from '../modules/auth/portal';

test('Global administrators can only authenticate through the admin portal',()=>{
 assert.equal(portalRoleAllowed('ADMIN','ADMIN'),true);
 assert.equal(portalRoleAllowed('ADMIN','MERCHANT'),false);
});
test('Merchants can only authenticate through the merchant portal',()=>{
 assert.equal(portalRoleAllowed('MERCHANT','MERCHANT'),true);
 assert.equal(portalRoleAllowed('MERCHANT','ADMIN'),false);
 for(const role of ['SUPPORT','MEMBER','OWNER','']) {
  assert.equal(portalRoleAllowed(role,'ADMIN'),false);
  assert.equal(portalRoleAllowed(role,'MERCHANT'),false);
 }
});
test('Portals do not share a session token hash or landing page',()=>{
 const token='a'.repeat(64);
 assert.notEqual(portalSessionHash(token,'ADMIN'),portalSessionHash(token,'MERCHANT'));
 assert.equal(portalLanding('ADMIN'),'/admin');
 assert.equal(portalLanding('MERCHANT'),'/mes-boutiques');
});
