import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {messageRules,messagingSettings,readMessaging,renderMessage,ruleForStatus,whatsappMessageUrl,MESSAGE_VARIABLES} from '../modules/messaging/customer-messages';

const state=()=>{const s=initialState(true);const o=s.orders[0];o.status='SHIPPED';o.carrier='Rapid Poste';o.tracking='RP-123';o.publicReceiptId='a'.repeat(64);return s;};

test('Every rule has a ready default message, enabled, using only known variables',()=>{
 const m=readMessaging(initialState(false));
 assert.deepEqual(messageRules.map(r=>r.key),['TO_CONFIRM','CONFIRMED','SHIPPED','DELIVERED']);
 for(const rule of messageRules){
  assert.equal(m.rules[rule.key].enabled,true);
  for(const variable of m.rules[rule.key].text.match(/\{[a-z_]+\}/g)||[])assert.ok(MESSAGE_VARIABLES.includes(variable as never),variable);
 }
});
test('A message is filled with the real order: customer, reference, amount, carrier, parcel and tracking link',()=>{
 const s=state(),o=s.orders[0];
 const text=renderMessage('Bonjour {client}, {reference} · {total} TND · {articles} · {transporteur} {colis} · {suivi} · {boutique}',s,o,'https://tunicom.example');
 const customer=s.customers.find(c=>c.id===o.customerId)!;
 assert.ok(text.startsWith('Bonjour '+customer.name.split(' ')[0]+', '+o.reference),text);
 assert.ok(text.includes((o.total/1000).toFixed(3).replace('.',','))||text.includes((o.total/1000).toFixed(3)),text);
 assert.ok(text.includes('Rapid Poste RP-123'));
 assert.ok(text.includes('https://tunicom.example/suivi/'+'a'.repeat(64)));
 assert.ok(text.includes(s.shop.name));
 // No tracking link or parcel yet: the placeholders disappear without leaving holes.
 o.publicReceiptId=undefined;o.tracking='';o.carrier='';
 assert.equal(renderMessage('Suivi : {suivi}|{transporteur}|{colis}',s,o,'https://x'),'Suivi : ||');
});
test('The WhatsApp link targets the customer number with the message, and refuses a non-Tunisian number',()=>{
 const url=whatsappMessageUrl('22123456','Bonjour & merci');
 assert.equal(url,'https://wa.me/21622123456?text='+encodeURIComponent('Bonjour & merci'));
 assert.equal(whatsappMessageUrl('+216 22 123 456','x'),'https://wa.me/21622123456?text=x');
 assert.equal(whatsappMessageUrl('123','x'),'');
});
test('Each status maps to its rule only when that rule is enabled',()=>{
 const s=initialState(false);
 assert.equal(ruleForStatus(s,'CONFIRMED')?.key,'CONFIRMED');
 assert.equal(ruleForStatus(s,'CANCELLED'),null);
 const next=applyAction(s,'messaging',{rules:{...readMessaging(s).rules,CONFIRMED:{enabled:false,text:'x'}}});
 assert.equal(ruleForStatus(next,'CONFIRMED'),null);
 assert.equal(readMessaging(next).rules.CONFIRMED.text,'x');
});
test('Settings are validated: known rules only, bounded text; sending is traced on the order',()=>{
 const rules=readMessaging(initialState(false)).rules;
 assert.equal(messagingSettings.safeParse({rules}).success,true);
 assert.equal(messagingSettings.safeParse({rules:{...rules,HACK:{enabled:true,text:'x'}}}).success,false);
 assert.equal(messagingSettings.safeParse({rules:{...rules,SHIPPED:{enabled:true,text:'x'.repeat(1001)}}}).success,false);
 assert.equal(messagingSettings.safeParse({rules:{...rules,SHIPPED:{enabled:true,text:'  '}}}).success,false);
 const s=state(),o=s.orders[0];
 const next=applyAction(s,'logMessage',{id:o.id,rule:'SHIPPED',channel:'WHATSAPP'});
 assert.equal(next.orders[0].events.at(-1)!.label,'Message WhatsApp préparé : Commande expédiée');
 assert.throws(()=>applyAction(s,'logMessage',{id:'nope',rule:'SHIPPED',channel:'WHATSAPP'}));
});
test('Default messages stay clean when the order has no parcel number or tracking link yet',()=>{
 const s=state(),o=s.orders[0];o.publicReceiptId=undefined;o.tracking='';
 const shipped=renderMessage(readMessaging(s).rules.SHIPPED.text,s,o,'https://x');
 assert.ok(!/Suivi\s*:\s*$/.test(shipped),shipped);
 assert.ok(!/\(colis\s*\)/.test(shipped),shipped);
 assert.ok(!/ {2}| \./.test(shipped),shipped);
 assert.ok(shipped.endsWith('TND.'),shipped);
 o.carrier='';
 assert.ok(renderMessage(readMessaging(s).rules.SHIPPED.text,s,o,'https://x').includes('est en route. Montant'));
});
