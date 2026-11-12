import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {defaultOrderMailTemplates,orderMailTemplates,orderMailChanges,renderOrderMail} from '../modules/messaging/order-mail';
test('Mail templates reject unknown variables, malformed braces and header injection',()=>{
 for(const subject of ['Bonjour {telephone}','{reference','x\r\nBcc: attacker@example.test','x\u0000'])
  assert.equal(orderMailTemplates.safeParse({...defaultOrderMailTemplates,ORDER_CREATED:{subject,body:'Message'}}).success,false);
 assert.equal(orderMailTemplates.safeParse({...defaultOrderMailTemplates,ORDER_CREATED:{subject:'{reference}',body:'{inconnu}'}}).success,false);
});
test('Arabic plain-text templates are valid and interpolate exact millimes',()=>{
 const template={subject:'طلب جديد {reference}',body:'{boutique}\n{statut}\n{total}\n{lien}\n{date}'};
 assert.equal(orderMailTemplates.safeParse({...defaultOrderMailTemplates,ORDER_CREATED:template}).success,true);
 const rendered=renderOrderMail(template,{shopName:'متجري',reference:'TC-1',status:'CONFIRMED',total:1001,url:'https://example.test/private',at:'2026-11-12T12:00:00Z'});
 assert.ok(rendered.text.includes('1.001 TND'));assert.ok(rendered.text.includes('متجري'));assert.ok(!rendered.text.includes('{'));
});
test('Shop and reference values cannot insert email headers or recursively expand variables',()=>{
 const result=renderOrderMail(defaultOrderMailTemplates.ORDER_CREATED,{shopName:'Shop\r\nBcc: nobody@example.test {lien}',reference:'TC\n1',status:'TO_CONFIRM',total:59000,url:'https://example.test/private',at:'2026-11-12T12:00:00Z'});
 assert.equal(/[\r\n]/.test(result.subject),false);assert.ok(result.subject.includes('{lien}'));
});
test('Only new orders and status changes generate an event',()=>{
 const before=initialState();const after=structuredClone(before);
 after.orders[0].notes='Private note edited';after.orders[1].status=after.orders[1].status==='CONFIRMED'?'PREPARING':'CONFIRMED';
 const fresh={...structuredClone(after.orders[0]),id:'new-order',reference:'TC-NEW'};after.orders.unshift(fresh);
 const changes=orderMailChanges(before,after);assert.equal(changes.length,2);
 assert.equal(changes[0].event,'ORDER_CREATED');assert.equal(changes[1].event,'ORDER_STATUS_CHANGED');
 const json=JSON.stringify(changes);for(const field of ['customerSnapshot','phone','address','notes','cost','publicReceiptId'])assert.equal(json.includes(field),false);
 assert.deepEqual(orderMailChanges(before,before),[]);
});
test('Repeated variables cannot overflow an encrypted job payload',()=>{
 const result=renderOrderMail({subject:'{boutique}'.repeat(16),body:'{boutique}'.repeat(400)},
  {shopName:'متجر'.repeat(45),reference:'TC-1',status:'TO_CONFIRM',total:1001,url:'https://example.test',at:'2026-11-12T12:00:00Z'});
 assert.equal(result.text.length,12000);assert.ok(result.subject.length<=998);
 assert.ok(Buffer.byteLength(JSON.stringify(result))<64000);
});
