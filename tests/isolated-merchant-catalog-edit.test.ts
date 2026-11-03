import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {merchantInventoryCsv,productEditPayload} from '../modules/shops/catalog-operations';

test('editing product metadata cannot replace reserved stock',()=>{
 const state=initialState(false);
 state.products=[{id:'p1',name:'Ancien',sku:'SKU1',category:'Général',variant:'',price:10000,cost:3000,stock:6,threshold:1,color:'#cbd5e1',active:true}];
 const update=productEditPayload(state.products[0],{
  name:'Nouveau',sku:'SKU1',category:'Vêtements',variant:'Noir',price:'15.250',cost:'4.500',threshold:'3'
 });
 const next=applyAction(state,'product',update);
 assert.equal(next.products[0].name,'Nouveau');
 assert.equal(next.products[0].price,15250);
 assert.equal(next.products[0].cost,4500);
 assert.equal(next.products[0].stock,6);
 assert.equal(next.products[0].threshold,3);
 assert.equal(state.products[0].name,'Ancien');
 assert.throws(()=>productEditPayload(state.products[0],{name:'x',sku:'s',category:'x',variant:'',price:'x',cost:'1',threshold:'2'}),/invalide/);
});
test('merchant CSV includes internal cost only for owner export and neutralizes formulas',()=>{
 const state=initialState(false);
 state.products=[{id:'p1',name:'=1+1',sku:'@CSV',category:'Général',variant:'',price:10000,cost:3000,stock:6,threshold:1,color:'#cbd5e1',active:true}];
 const csv=merchantInventoryCsv(state.products);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.ok(csv.includes('"\'=1+1"'));
 assert.ok(csv.includes('"\'@CSV"'));
 assert.ok(csv.includes('3.000'));
});
