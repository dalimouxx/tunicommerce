import test from 'node:test';
import assert from 'node:assert/strict';
import {customerOrderMessage,tunisianWhatsAppUrl} from '../modules/shops/manual-messaging';
test('templates are human-controlled and never claim verified delivery',()=>{
 const text=customerOrderMessage({reference:'TC-1001',status:'SHIPPED',tracking:'TRK-123'},'Ma boutique');
 assert.match(text,/TC-1001/);
 assert.match(text,/TRK-123/);
 assert.match(text,/manuellement/);
 assert.equal(text.includes('envoyé avec succès'),false);
 assert.equal(customerOrderMessage({reference:'TC-1001',status:'READY',tracking:'PRIVATE'},'Ma boutique').includes('PRIVATE'),false);
});
test('only Tunisian numbers are eligible for explicit WhatsApp links',()=>{
 const text='Bonjour & à bientôt';
 assert.equal(tunisianWhatsAppUrl('22123456',text),'https://wa.me/21622123456?text='+encodeURIComponent(text));
 assert.equal(tunisianWhatsAppUrl('+216 22123456',text),'https://wa.me/21622123456?text='+encodeURIComponent(text));
 assert.equal(tunisianWhatsAppUrl('+33999999999',text),null);
 assert.equal(tunisianWhatsAppUrl('javascript:alert(1)',text),null);
});
test('sanitizes control characters and rejects arbitrary statuses',()=>{
 const t=customerOrderMessage({reference:'TC-\n1001',status:'TO_CONFIRM'},'Boutique\r\nNom');
 assert.equal(t.includes('\n'),false);
 assert.throws(()=>customerOrderMessage({reference:'TC-1',status:'BANK_VERIFIED'}),/inconnu/);
});
