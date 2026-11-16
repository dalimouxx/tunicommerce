import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {confirmationView,confirmationMessage,CONFIRMATION_TTL_MS} from '../modules/shops/order-confirmation';

const order={name:'Amira Ben Ali',phone:'22123456',city:'Tunis',address:'12 rue de Marseille, Tunis',source:'Manuel',items:[{productId:'p1',quantity:1}]};
function pending(){
 const state=applyAction(initialState(true),'createOrder',order);
 return {state,id:state.orders[0].id};
}
const issue=(state:ReturnType<typeof pending>['state'],id:string)=>{
 const next=applyAction(state,'issueConfirmationLink',{orderId:id});
 return {next,token:next.orders.find(o=>o.id===id)!.confirmation!.token};
};

test('the merchant prepares one reusable link per pending order',()=>{
 const {state,id}=pending();
 const {next,token}=issue(state,id);
 assert.match(token,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 const again=applyAction(next,'issueConfirmationLink',{orderId:id});
 assert.equal(again.orders[0].confirmation!.token,token,'still valid link is reused');
 assert.ok(next.orders[0].events.some(event=>/Lien de confirmation/.test(event.label)));
 const confirmed=applyAction(state,'transition',{id,status:'CONFIRMED'});
 assert.throws(()=>applyAction(confirmed,'issueConfirmationLink',{orderId:id}),/attente de confirmation/);
});
test('the customer confirms with one click and the answer is final',()=>{
 const {state,id}=pending();const {next,token}=issue(state,id);
 const done=applyAction(next,'customerConfirmation',{token,answer:'CONFIRMED'});
 const o=done.orders.find(x=>x.id===id)!;
 assert.equal(o.status,'CONFIRMED');
 assert.equal(o.confirmation!.answer,'CONFIRMED');
 assert.ok(o.events.some(event=>/via le lien client/.test(event.label)));
 assert.throws(()=>applyAction(done,'customerConfirmation',{token,answer:'CANCELLED'}),/déjà répondu/);
});
test('a change request goes back to the call center with the customer message',()=>{
 const {state,id}=pending();const {next,token}=issue(state,id);
 assert.throws(()=>applyAction(next,'customerConfirmation',{token,answer:'CHANGE',note:''}));
 const done=applyAction(next,'customerConfirmation',{token,answer:'CHANGE',note:'Livrer plutôt à Sfax, rue Habib Thameur'});
 const o=done.orders.find(x=>x.id===id)!;
 assert.equal(o.status,'CALLBACK');
 assert.ok(o.events.some(event=>event.label.includes('Livrer plutôt à Sfax')));
});
test('cancelling releases the reserved stock like a merchant cancellation',()=>{
 const {state,id}=pending();const {next,token}=issue(state,id);
 const before=next.products.find(p=>p.id==='p1')!.stock;
 const done=applyAction(next,'customerConfirmation',{token,answer:'CANCELLED'});
 assert.equal(done.orders.find(x=>x.id===id)!.status,'CANCELLED');
 assert.equal(done.products.find(p=>p.id==='p1')!.stock,before+1);
});
test('expired links, unknown links and orders already handled refuse an answer',()=>{
 const {state,id}=pending();const {next,token}=issue(state,id);
 next.orders[0].confirmation!.expiresAt=new Date(Date.now()-1000).toISOString();
 assert.throws(()=>applyAction(next,'customerConfirmation',{token,answer:'CONFIRMED'}),/expiré/);
 assert.throws(()=>applyAction(next,'customerConfirmation',{token:crypto.randomUUID(),answer:'CONFIRMED'}),/introuvable/);
 const fresh=issue(state,id);
 const handled=applyAction(fresh.next,'transition',{id,status:'CONFIRMED'});
 assert.throws(()=>applyAction(handled,'customerConfirmation',{token:fresh.token,answer:'CANCELLED'}),/déjà été traitée/);
});
test('public view and WhatsApp message expose only what the customer needs',()=>{
 const {state,id}=pending();const {next,token}=issue(state,id);
 const view=confirmationView(next,token,new Date())!;
 assert.equal(view.reference,next.orders[0].reference);
 assert.equal(view.customer.name,'Amira Ben Ali');
 assert.equal(view.canAnswer,true);
 assert.ok(!JSON.stringify(view).includes('cost'));
 assert.equal(confirmationView(next,crypto.randomUUID(),new Date()),null);
 assert.equal(CONFIRMATION_TTL_MS,7*24*3600_000);
 const text=confirmationMessage(next.orders[0],'https://tunicom.example/vitrines/demo/confirmer/'+token,'Ma boutique');
 assert.ok(text.includes(next.orders[0].reference)&&text.includes('/confirmer/'+token)&&text.includes('Ma boutique'));
 assert.ok(text.includes('TND'));
});
