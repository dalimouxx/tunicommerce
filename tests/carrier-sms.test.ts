import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {carrierManifestRows,carrierManifestFilename,manifestCarriers} from '../modules/delivery/carrier-manifest';
import {dispatchManifestCsv} from '../modules/shops/dispatch-manifest';
import {smsMessageUrl} from '../modules/messaging/customer-messages';

function shop(){
 const s=initialState(true);
 s.orders.forEach((o,i)=>{o.status=i<120?(i%3===0?'READY':i%3===1?'SHIPPED':'DELIVERED'):'DELIVERED';o.carrier=i%2?'Rapid-Poste':'Transporteur local';});
 return s;
}
test('The manifest lists the parcels to hand over, by status and carrier, without the 100-row page limit',()=>{
 const s=shop();
 for(let i=0;i<150;i++)s.orders.push({...structuredClone(s.orders[0]),id:'x'+i,reference:'X-'+i,status:'READY',carrier:'Rapid-Poste'});
 const ready=carrierManifestRows(s,{status:'READY',carrier:''});
 assert.equal(ready.length,s.orders.filter(o=>o.status==='READY').length);
 assert.ok(ready.length>100);
 const rapid=carrierManifestRows(s,{status:'READY',carrier:'Rapid-Poste'});
 assert.ok(rapid.length>0&&rapid.every(r=>r.carrier==='Rapid-Poste'));
 const both=carrierManifestRows(s,{status:'ALL',carrier:''});
 assert.equal(both.length,s.orders.filter(o=>o.status==='READY'||o.status==='SHIPPED').length);
 assert.deepEqual(manifestCarriers(s),['Rapid-Poste','Transporteur local']);
 assert.equal(carrierManifestRows(initialState(false),{status:'READY',carrier:''}).length,0);
});
test('The CSV is the existing formula-safe format; the file name carries the date and carrier',()=>{
 const s=shop();s.orders[0].status='READY';
 const customer=s.customers.find(c=>c.id===s.orders[0].customerId)!;customer.name='=HYPERLINK("x")';s.orders[0].customerSnapshot=structuredClone(customer);
 const csv=dispatchManifestCsv(carrierManifestRows(s,{status:'READY',carrier:''}));
 assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'),'formula neutralised');
 assert.equal(carrierManifestFilename(new Date('2026-11-20T10:00:00Z'),'Rapid-Poste'),'bordereau-2026-11-20-rapid-poste.csv');
 assert.equal(carrierManifestFilename(new Date('2026-11-20T10:00:00Z'),''),'bordereau-2026-11-20.csv');
});
test('SMS links open the phone messaging app with the text; a non-Tunisian number gives no link; sending is traced',()=>{
 assert.equal(smsMessageUrl('22 123 456','Bonjour & merci'),'sms:+21622123456?body='+encodeURIComponent('Bonjour & merci'));
 assert.equal(smsMessageUrl('123','x'),'');
 const s=shop();const o=s.orders[0];o.status='SHIPPED';
 const next=applyAction(s,'logMessage',{id:o.id,rule:'SHIPPED',channel:'SMS'});
 assert.equal(next.orders[0].events.at(-1)!.label,'Message SMS préparé : Commande expédiée');
 assert.throws(()=>applyAction(s,'logMessage',{id:o.id,rule:'SHIPPED',channel:'EMAIL'}));
});
