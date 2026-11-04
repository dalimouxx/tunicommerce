import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {brandingMutation,merchantBrandingView} from '../modules/shops/merchant-branding';
import {isolatedStorefrontPreview} from '../modules/shops/storefront-preview';
const payload={name:'Boutique Tunis',description:'Vêtements et accessoires',phone:'22123456',
 address:'Gabès, Tunisie',shipping:7000,logoUrl:'https://static.example.test/logo.png',bannerUrl:'https://static.example.test/banner.jpg'};
test('branding persists without replacing theme, orders, stock or cost',()=>{
 let state=initialState(false);
 state=applyAction(state,'saveStorefrontTheme',{theme:'MINUIT'});
 const next=applyAction(state,'settings',payload);
 assert.equal(next.shop.theme,'MINUIT');
 assert.equal(merchantBrandingView(next).name,'Boutique Tunis');
 const preview=isolatedStorefrontPreview(next);
 assert.equal(preview.bannerUrl,payload.bannerUrl);
 assert.equal(preview.logoUrl,payload.logoUrl);
 assert.equal(preview.name,'Boutique Tunis');
 assert.equal(preview.theme.code,'MINUIT');
 assert.equal(state.shop.name,'Ma boutique');
});
test('external insecure images and forged data rejected',()=>{
 const req={action:'settings',requestId:crypto.randomUUID(),payload};
 assert.equal(brandingMutation.safeParse(req).success,true);
 assert.equal(brandingMutation.safeParse({...req,payload:{...payload,logoUrl:'http://malicious.test/image.jpg'}}).success,false);
 assert.equal(brandingMutation.safeParse({...req,payload:{...payload,ownerId:'other'}}).success,false);
 assert.equal(brandingMutation.safeParse({...req,payload:{...payload,shipping:-1}}).success,false);
});
test('public preview keeps internal costs hidden despite branding',()=>{
 const state=applyAction(initialState(false),'settings',payload);
 const projected=JSON.stringify(isolatedStorefrontPreview(state));
 assert.equal(projected.includes('adminToken'),false);
 assert.equal(projected.includes('cost'),false);
});
