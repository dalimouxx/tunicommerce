import test from 'node:test';
import assert from 'node:assert/strict';
import {organizationInput,newShopInput,shopIdInput} from '../modules/shops/validation';
import {canAccessShop} from '../modules/shops/permissions';

test('Organization names are trimmed and validated',()=>{
 assert.equal(organizationInput.parse({name:'  Boutique Centrale  '}).name,'Boutique Centrale');
 assert.throws(()=>organizationInput.parse({name:'a'}));
 assert.throws(()=>organizationInput.parse({name:'abc',ownerId:'forged'}));
 assert.throws(()=>organizationInput.parse({name:'x'.repeat(101)}));
});

test('Shop slugs and organization IDs cannot be forged or malformed',()=>{
 const input={organizationId:'123e4567-e89b-42d3-a456-426614174000',name:'Sfax Store',slug:'sfax-store'};
 assert.deepEqual(newShopInput.parse(input),input);
 for(const slug of ['ACME','a b','a--b','-shop','a','x'.repeat(61)])
  assert.throws(()=>newShopInput.parse({...input,slug}));
 assert.throws(()=>newShopInput.parse({...input,ownerId:'other'}));
 assert.throws(()=>newShopInput.parse({...input,organizationId:'wrong'}));
 assert.equal(shopIdInput.parse(input.organizationId),input.organizationId);
});

test('Read-only roles cannot list team members or modify stock',()=>{
 for(const role of ['VIEWER','CALL_CENTER','ACCOUNTANT','DELIVERY_MANAGER']){
  assert.equal(canAccessShop(role,'team.manage'),false);
  assert.equal(canAccessShop(role,'stock.adjust'),false);
 }
 assert.equal(canAccessShop('OWNER','team.manage'),true);
 assert.equal(canAccessShop('ADMIN','team.manage'),true);
});
