import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {pixelIds,pixelSettingsPayload,storefrontMarketing} from '../modules/shops/storefront-marketing';

test('Saving pixels keeps the WhatsApp contact and language; identifiers are validated and normalised',()=>{
 let s=initialState(false);
 s=applyAction(s,'marketing',{metaPixelId:'',tiktokPixelId:'',whatsapp:'22123456',whatsappMessage:'Bonjour',language:'ar'});
 const next=applyAction(s,'marketing',pixelSettingsPayload(s,{metaPixelId:' 123456789012345 ',tiktokPixelId:'c4abcdefghij1234567'}));
 assert.deepEqual(storefrontMarketing(next),{metaPixelId:'123456789012345',tiktokPixelId:'C4ABCDEFGHIJ1234567',whatsapp:'22123456',whatsappMessage:'Bonjour',language:'ar'});
 assert.throws(()=>applyAction(s,'marketing',pixelSettingsPayload(s,{metaPixelId:'12ab',tiktokPixelId:''})),/Pixel Meta/);
 assert.throws(()=>applyAction(s,'marketing',pixelSettingsPayload(s,{metaPixelId:'',tiktokPixelId:'<script>'})),/Pixel TikTok/);
});
test('Only the two pixel identifiers reach the public page',()=>{
 const s=applyAction(initialState(false),'marketing',{metaPixelId:'123456789012345',tiktokPixelId:'',whatsapp:'22123456',whatsappMessage:'Message privé',language:'fr'});
 assert.deepEqual(pixelIds(storefrontMarketing(s)),{metaPixelId:'123456789012345',tiktokPixelId:''});
});
