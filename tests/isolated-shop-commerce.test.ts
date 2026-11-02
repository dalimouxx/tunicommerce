import test from 'node:test';
import assert from 'node:assert/strict';
import {mayInitializeCommerce,newShopState} from '../modules/shops/isolated-commerce';

test('only active owner may bootstrap a brand-new unlinked shop',()=>{
 const valid={active:true,role:'OWNER',legacyWorkspaceId:null};
 assert.equal(mayInitializeCommerce(valid),true);
 assert.equal(mayInitializeCommerce({...valid,active:false}),false);
 assert.equal(mayInitializeCommerce({...valid,role:'ADMIN'}),false);
 assert.equal(mayInitializeCommerce({...valid,role:'MANAGER'}),false);
 assert.equal(mayInitializeCommerce({...valid,legacyWorkspaceId:'legacy-a'}),false);
});
test('new shop state starts empty and non-demo',()=>{
 const state=newShopState('Nouveau magasin');
 assert.equal(state.shop.name,'Nouveau magasin');
 assert.equal(state.demo,false);
 assert.equal(state.orders.length,0);
 assert.equal(state.customers.length,0);
 assert.equal(state.products.length,0);
});
