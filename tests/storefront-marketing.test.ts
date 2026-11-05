import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {
 marketingMutation,marketingSettings,orderWhatsappMessage,productWhatsappMessage,
 storefrontMarketing,whatsappLink
} from '../modules/shops/storefront-marketing';
import {publicProductDetail} from '../modules/shops/public-product-detail';

test('pixel identifiers and WhatsApp number are validated and normalized',()=>{
 const ok=marketingSettings.parse({metaPixelId:'123456789012345',tiktokPixelId:'c9abcdef1234567890ab',
  whatsapp:'+216 22 123 456',whatsappMessage:' Bonjour '});
 assert.deepEqual(ok,{metaPixelId:'123456789012345',tiktokPixelId:'C9ABCDEF1234567890AB',whatsapp:'22123456',whatsappMessage:'Bonjour'});
 assert.equal(marketingSettings.safeParse({metaPixelId:'',tiktokPixelId:'',whatsapp:'',whatsappMessage:''}).success,true);
 assert.equal(marketingSettings.safeParse({metaPixelId:'abc<script>',tiktokPixelId:'',whatsapp:'',whatsappMessage:''}).success,false);
 assert.equal(marketingSettings.safeParse({metaPixelId:'',tiktokPixelId:'x"; alert(1)//',whatsapp:'',whatsappMessage:''}).success,false);
 assert.equal(marketingSettings.safeParse({metaPixelId:'',tiktokPixelId:'',whatsapp:'71123456',whatsappMessage:''}).success,false);
 assert.equal(marketingMutation.safeParse({action:'marketing',requestId:'11111111-1111-4111-8111-111111111111',
  payload:{metaPixelId:'',tiktokPixelId:'',whatsapp:'',whatsappMessage:'',accessToken:'secret'}}).success,false);
});

test('marketing action stores only the validated fields and keeps branding intact',()=>{
 const state=initialState(false);state.shop.name='Dar Zitouna';
 const next=applyAction(state,'marketing',{metaPixelId:'123456789012345',tiktokPixelId:'',whatsapp:'98 765 432',whatsappMessage:''});
 assert.equal(next.shop.name,'Dar Zitouna');
 assert.deepEqual(storefrontMarketing(next),{metaPixelId:'123456789012345',tiktokPixelId:'',whatsapp:'98765432',whatsappMessage:''});
 assert.deepEqual(storefrontMarketing(state),{metaPixelId:'',tiktokPixelId:'',whatsapp:'',whatsappMessage:''});
 assert.throws(()=>applyAction(state,'marketing',{metaPixelId:'bad',tiktokPixelId:'',whatsapp:'',whatsappMessage:''}));
});

test('public product detail exposes marketing identifiers but still hides the private shop phone',()=>{
 const state=initialState(false);state.shop.phone='22123456';
 state.products=[{id:'p1',name:'Chemise',sku:'S-01',category:'Mode',variant:'',price:45000,cost:23000,
  stock:2,threshold:1,color:'#fff',active:true}];
 const next=applyAction(state,'marketing',{metaPixelId:'123456789012345',tiktokPixelId:'',whatsapp:'98765432',whatsappMessage:''});
 const detail=publicProductDetail(next,'p1')!;
 assert.equal(detail.store.marketing.whatsapp,'98765432');
 assert.equal(JSON.stringify(detail).includes('22123456'),false);
});

test('WhatsApp links are pre-filled and refuse invalid numbers',()=>{
 assert.equal(whatsappLink('22123456'),'https://wa.me/21622123456');
 assert.equal(whatsappLink('22123456','Bonjour & merci'),'https://wa.me/21622123456?text=Bonjour%20%26%20merci');
 assert.equal(whatsappLink('7112'),'');
 assert.equal(productWhatsappMessage({metaPixelId:'',tiktokPixelId:'',whatsapp:'22123456',whatsappMessage:''},'Huile'),
  'Bonjour, je suis intéressé(e) par : Huile');
 assert.equal(orderWhatsappMessage('TC-1001',119700),'Bonjour, je confirme ma commande TC-1001 (119.700 TND).');
});
