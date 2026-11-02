import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {projectProductsForRole,projectOrdersForRole} from '../modules/shops/team-views';
import {canAccessShop} from '../modules/shops/permissions';

test('only role-permitted reads are eligible',()=>{
 assert.equal(canAccessShop('CALL_CENTER','orders.read'),true);
 assert.equal(canAccessShop('CALL_CENTER','stock.adjust'),false);
 assert.equal(canAccessShop('STOCK','products.read'),true);
 assert.equal(canAccessShop('STOCK','customers.read'),false);
 assert.equal(canAccessShop('VIEWER','products.write'),false);
 assert.equal(canAccessShop('ACCOUNTANT','orders.read'),true);
 assert.equal(canAccessShop('UNKNOWN','orders.read'),false);
});
test('inventory cost cannot leak to stock operators, viewers or call center',()=>{
 const state=initialState(true);
 for(const role of ['STOCK','CALL_CENTER','VIEWER']){
  const data=projectProductsForRole(state.products,role);
  assert.equal('cost' in data[0],false);
 }
 assert.equal('cost' in projectProductsForRole(state.products,'OWNER')[0],true);
});
test('order PII and unit costs excluded from restricted roles',()=>{
 const state=initialState(true);
 const order=state.orders[0];
 const decorated={...order,customerSnapshot:state.customers[0],notes:'Client privé',
  riskSignals:[{code:'RISK',label:'Privé',level:'warning' as const}]};
 for(const role of ['STOCK','ACCOUNTANT','VIEWER']){
  const result=projectOrdersForRole([decorated],role)[0];
  const json=JSON.stringify(result);
  assert.equal(json.includes(state.customers[0].phone),false);
  assert.equal(json.includes(state.customers[0].address),false);
  assert.equal(json.includes('Client privé'),false);
  assert.equal(json.includes('"cost"'),false);
  assert.equal(json.includes('riskSignals'),false);
 }
 assert.equal(JSON.stringify(projectOrdersForRole([decorated],'CALL_CENTER')[0]).includes(state.customers[0].phone),true);
});
