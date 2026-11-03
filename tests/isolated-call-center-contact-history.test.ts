import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {contactLogNote,contactHistory,contactHistoryStats} from '../modules/shops/contact-history';

test('contact result is an explicit agent-entered note, never a sent message',()=>{
 const note=contactLogNote('WhatsApp','Sans réponse');
 assert.equal(note,'Contact manuel · WhatsApp · Sans réponse');
 assert.throws(()=>contactLogNote('Autre' as never,'Sans réponse'),/non reconnu/);
 const s=initialState(false);
 s.products=[{id:'p',name:'Produit',sku:'P',category:'Général',variant:'',price:1000,cost:100,stock:2,threshold:1,color:'#aaaaaa',active:true}];
 const ordered=applyAction(s,'createOrder',{name:'Client',phone:'22123456',city:'Gabès',address:'Rue du marché',source:'Boutique',items:[{productId:'p',quantity:1}]});
 const next=applyAction(ordered,'note',{id:ordered.orders[0].id,note});
 assert.equal(contactHistory(next.orders[0])[0].label,'WhatsApp · Sans réponse');
 assert.equal(contactHistoryStats(next.orders).attempts,1);
 assert.equal(next.orders[0].status,'TO_CONFIRM');
 assert.equal(ordered.orders[0].events.length,1);
});
test('unrelated notes are not mistaken for outbound communication',()=>{
 assert.equal(contactHistory({events:[{at:'2026-11-03',label:'Appel automatique simulé'}]}).length,0);
});
