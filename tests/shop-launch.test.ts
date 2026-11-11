import test from 'node:test';import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';import {suggestShopSlug,shopLaunchReadiness} from '../modules/shops/shop-launch';
test('shop links are suggested without accents and never silently invent a non-Latin name',()=>{
 assert.equal(suggestShopSlug('  Éclat & Création  '),'eclat-creation');assert.equal(suggestShopSlug('مرحبا'),'');assert.equal(suggestShopSlug('A'.repeat(61)).length,60);assert.equal(suggestShopSlug('Test --- 2026'),'test-2026');
});
test('launch checklist follows publication requirements while branding stays recommended',()=>{
 const state=initialState(false);const input={state,initialized:false,status:'DRAFT',subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date('2030-02-01')};const now=new Date('2030-01-01');
 assert.equal(shopLaunchReadiness(input,now).ready,false);
 state.products=initialState(true).products.slice(0,1);state.products[0].stock=0;
 const ready=shopLaunchReadiness({...input,initialized:true},now);assert.equal(ready.ready,true);assert.equal(ready.publiclyAvailable,false);assert.equal(ready.steps.find(step=>step.id==='identity')!.required,false);
 assert.equal(shopLaunchReadiness({...input,initialized:true,status:'PUBLISHED'},now).publiclyAvailable,true);
 assert.equal(shopLaunchReadiness({...input,initialized:true,status:'PUBLISHED',subscriptionEndsAt:now},now).publiclyAvailable,false);
 assert.equal(shopLaunchReadiness({...input,initialized:true,subscriptionStatus:'SUSPENDED'},now).ready,false);
 state.products[0].active=false;assert.equal(shopLaunchReadiness({...input,initialized:true},now).ready,false);
});
