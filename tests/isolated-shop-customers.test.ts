import {pageOperationalQueue} from '../modules/shops/operational-queues';
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

test('P2 customer directory navigation preserves every record beyond 100',()=>{
 const rows=Array.from({length:213},(_,i)=>({name:'Client '+i,phone:String(i)}));
 const pages=Array.from({length:5},(_,i)=>pageOperationalQueue(rows,i+1,50));
 assert.deepEqual(pages.map(p=>p.items.length),[50,50,50,50,13]);
 assert.equal(new Set(pages.flatMap(p=>p.items.map(x=>x.name))).size,213);
 assert.equal(pageOperationalQueue(rows,999,50).page,5);
});
