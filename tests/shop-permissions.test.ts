import test from 'node:test';
import assert from 'node:assert/strict';
import {canAccessShop,shopRoles} from '../modules/shops/permissions';

test('All supported shop roles can read shop basics',()=>{
 for(const role of shopRoles)assert.equal(canAccessShop(role,'shops.read'),true);
});
test('Shop permissions deny unknown roles by default',()=>{
 for(const role of ['','ADMINISTRATOR','admin','SUPER_ADMIN','OWNER ']){
  assert.equal(canAccessShop(role,'orders.read'),false);
  assert.equal(canAccessShop(role,'finance.write'),false);
 }
});
test('Call center, stock, delivery and accounting are least-privilege',()=>{
 assert.equal(canAccessShop('CALL_CENTER','orders.update'),true);
 assert.equal(canAccessShop('CALL_CENTER','finance.read'),false);
 assert.equal(canAccessShop('STOCK','stock.adjust'),true);
 assert.equal(canAccessShop('STOCK','team.manage'),false);
 assert.equal(canAccessShop('DELIVERY_MANAGER','orders.update'),true);
 assert.equal(canAccessShop('DELIVERY_MANAGER','stock.adjust'),false);
 assert.equal(canAccessShop('ACCOUNTANT','finance.write'),true);
 assert.equal(canAccessShop('ACCOUNTANT','orders.cancel'),false);
 assert.equal(canAccessShop('VIEWER','orders.update'),false);
 assert.equal(canAccessShop('OWNER','team.manage'),true);
});
