import test from 'node:test';
import assert from 'node:assert/strict';
import {hasPlatformPermission,permissions} from '../modules/auth/permissions';

test('Platform permissions deny unknown roles by default',()=>{
 for(const role of ['','VIEWER','OWNER','ADMINISTRATOR','admin','MERCHANT '])
  for(const permission of permissions)assert.equal(hasPlatformPermission(role,permission),false);
});
test('Merchants cannot create or update platform shops',()=>{
 assert.equal(hasPlatformPermission('MERCHANT','shops.create'),false);
 assert.equal(hasPlatformPermission('MERCHANT','shops.update'),false);
 assert.equal(hasPlatformPermission('MERCHANT','orders.read'),true);
});
test('Administrators have explicit platform grants',()=>{
 for(const permission of permissions)assert.equal(hasPlatformPermission('ADMIN',permission),true);
});
