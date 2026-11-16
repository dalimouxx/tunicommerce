import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {phoneKey,deliveryOutcomes,reliabilityCounts,reliabilityLabel} from '../modules/reliability/policy';

const secret={APP_ENCRYPTION_SECRET:'x'.repeat(40)};
test('the phone key is a keyed hash of the normalised number, never the number itself',()=>{
 const key=phoneKey('+216 22 123 456',secret)!;
 assert.match(key,/^[0-9a-f]{64}$/);
 assert.equal(phoneKey('22123456',secret),key);
 assert.equal(phoneKey('22.123.456',secret),key);
 assert.notEqual(phoneKey('22123457',secret),key);
 assert.notEqual(phoneKey('22123456',{APP_ENCRYPTION_SECRET:'y'.repeat(40)}),key,'depends on the server secret');
 assert.ok(!key.includes('22123456'));
 assert.equal(phoneKey('22123456',{}),null,'disabled without a secret');
 assert.equal(phoneKey('123',secret),null);
});
test('only delivered orders and orders returned after shipping count, cancellations never do',()=>{
 let s=initialState(true);s.orders=[];
 const productId='p1';
 const make=(phone:string)=>{s=applyAction(s,'createOrder',{name:'Client',phone,city:'Tunis',address:'12 rue de Marseille',source:'Manuel',items:[{productId,quantity:1}]});return s.orders[0].id;};
 const walk=(id:string,steps:string[])=>{for(const status of steps)s=applyAction(s,'transition',{id,status,...(status==='SHIPPED'?{carrier:'Poste',tracking:'T'+id.slice(0,6)}:{})});};
 const delivered=make('22123456');walk(delivered,['CONFIRMED','PREPARING','READY','SHIPPED','DELIVERED']);
 const refused=make('22123456');walk(refused,['CONFIRMED','PREPARING','READY','SHIPPED','RETURNED']);
 const cancelled=make('22123456');walk(cancelled,['CANCELLED']);
 make('22123456');
 const rows=deliveryOutcomes(s);
 assert.deepEqual(rows.map(r=>[r.orderId,r.outcome]).sort(),[[delivered,'DELIVERED'],[refused,'REFUSED']].sort());
 assert.ok(rows.every(r=>r.phone==='22123456'&&!Number.isNaN(Date.parse(r.occurredAt))));
});
test('pending and accepted contests do not count; a rejected contest counts again',()=>{
 const rows=[{outcome:'DELIVERED',contestStatus:null},{outcome:'REFUSED',contestStatus:null},{outcome:'REFUSED',contestStatus:'PENDING'},
  {outcome:'REFUSED',contestStatus:'ACCEPTED'},{outcome:'REFUSED',contestStatus:'REJECTED'}];
 assert.deepEqual(reliabilityCounts(rows),{delivered:1,refused:2});
 assert.deepEqual(reliabilityCounts([]),{delivered:0,refused:0});
});
test('the merchant label states plain counts and nothing when there is no history',()=>{
 assert.equal(reliabilityLabel({delivered:6,refused:2}),'Historique Tunicom : 6 livrées · 2 refusées (toutes boutiques)');
 assert.equal(reliabilityLabel({delivered:1,refused:0}),'Historique Tunicom : 1 livrée · 0 refusée (toutes boutiques)');
 assert.equal(reliabilityLabel({delivered:0,refused:0}),null);
});
