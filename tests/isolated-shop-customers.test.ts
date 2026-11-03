import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {isolatedCustomerDirectory} from '../modules/shops/customer-directory';

test('customer directory excludes private address, notes and order contents',()=>{
 const state=initialState(false);
 state.customers=[{id:'a',name:'Client Test',phone:'22123456',city:'Gabès',address:'Rue privée',notes:'Information confidentielle'}];
 const result=isolatedCustomerDirectory(state);
 assert.equal(result.length,1);
 assert.equal(result[0]?.name,'Client Test');
 assert.equal(result[0]?.orderCount,0);
 assert.equal(JSON.stringify(result).includes('Rue privée'),false);
 assert.equal(JSON.stringify(result).includes('Information confidentielle'),false);
 assert.deepEqual(Object.keys(result[0]!),['name','phone','city','orderCount','deliveredCount','deliveredGrossMillimes']);
});
test('empty isolated shop has no customers',()=>{
 assert.deepEqual(isolatedCustomerDirectory(initialState(false)),[]);
});
