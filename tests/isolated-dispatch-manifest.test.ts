import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {dispatchManifest,dispatchManifestPage,parseDispatchManifestQuery,dispatchManifestCsv,csvCell} from '../modules/shops/dispatch-manifest';

test('manifest includes ready/shipped only and uses captured customer snapshot',()=>{
 const state=initialState(false);
 state.products=[{id:'p',name:'Article',sku:'ABC',category:'Mode',variant:'Noir',price:10000,cost:2500,stock:3,threshold:1,color:'#ffffff',active:true}];
 let next=applyAction(state,'createOrder',{name:'Client suivi',phone:'22123456',city:'Gabès',address:'Adresse privée',source:'Boutique',items:[{productId:'p',quantity:1}]});
 const id=next.orders[0].id;
 next=applyAction(next,'transition',{id,status:'CONFIRMED'});
 next=applyAction(next,'transition',{id,status:'PREPARING'});
 next=applyAction(next,'transition',{id,status:'READY'});
 const ready=dispatchManifest(next);
 assert.equal(ready.length,1);
 assert.equal(ready[0].status,'READY');
 assert.equal(ready[0].quantity,1);
 assert.equal(ready[0].codMillimes,next.orders[0].total);
 next=applyAction(next,'transition',{id,status:'SHIPPED',carrier:'Transport',tracking:'SUIVI-1'});
 assert.equal(dispatchManifest(next)[0].carrier,'Transport');
 next=applyAction(next,'transition',{id,status:'DELIVERED'});
 assert.deepEqual(dispatchManifest(next),[]);
});
test('CSV escaping neutralizes spreadsheet formula injection and keeps UTF-8/3-digit TND',()=>{
 assert.equal(csvCell('=1+1'),JSON.stringify("'=1+1"));
 assert.equal(csvCell('  +2'),JSON.stringify("'+2"));
 const csv=dispatchManifestCsv([{reference:'=1+1',status:'READY',carrier:'Test',tracking:'',customer:'Client',phone:'22123456',city:'Gabès',address:'Rue du marché',items:'Article × 2',quantity:2,codMillimes:12345}]);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.ok(csv.includes('12.345'));
 assert.ok(csv.includes(JSON.stringify("'=1+1")));
});

test('P3 export : pages successives sans perte silencieuse des colis',()=>{
 const state=initialState(false);
 state.products=[{id:'p',name:'Article',sku:'P',category:'Mode',variant:'',price:12000,cost:1000,
  stock:3,threshold:1,color:'#ffffff',active:true}];
 let seed=applyAction(state,'createOrder',{name:'Acheteur',phone:'22123456',city:'Gabès',
  address:'Rue test',source:'Boutique',items:[{productId:'p',quantity:1}]});
 const id=seed.orders[0].id;
 for(const status of ['CONFIRMED','PREPARING','READY'] as const)seed=applyAction(seed,'transition',{id,status});
 const sample=seed.orders[0];
 seed.orders=Array.from({length:235},(_,i)=>({...sample,id:'o-'+i,reference:'TC-'+i,
  status:i%2===0?'READY' as const:'SHIPPED' as const}));
 const first=dispatchManifestPage(seed,{status:'ALL',page:1});
 const second=dispatchManifestPage(seed,{status:'ALL',page:2});
 const third=dispatchManifestPage(seed,{status:'ALL',page:3});
 assert.deepEqual([first.rows.length,second.rows.length,third.rows.length],[100,100,35]);
 assert.deepEqual([first.total,first.totalPages,first.readyCount,first.shippedCount],[235,3,118,117]);
 assert.equal(new Set([...first.rows,...second.rows,...third.rows].map(x=>x.reference)).size,235);
 assert.equal(dispatchManifestPage(seed,{status:'READY',page:2}).rows.length,18);
 assert.throws(()=>dispatchManifestPage(seed,{status:'ALL',page:4}),/Page introuvable/);
 assert.equal(dispatchManifest(seed).length,100); // backward compatibility
});

test('P1/P3 export : parsing strict et formules CSV avec préfixes Unicode neutralisées',()=>{
 assert.deepEqual(parseDispatchManifestQuery(new URLSearchParams('status=SHIPPED&page=2&format=json')),
  {status:'SHIPPED',page:2,format:'json'});
 for(const invalid of ['page=0','page=-1','page=12345','status=LOST','format=html',
  'format=csv&format=json','page=1&page=2','url=https://evil.test']){
  assert.throws(()=>parseDispatchManifestQuery(new URLSearchParams(invalid)));
 }
 assert.equal(csvCell('\u200b=SUM(A1:A2)'),JSON.stringify("'=SUM(A1:A2)"));
 assert.equal(csvCell('\u202e+HYPERLINK("bad")'),`"'+HYPERLINK(""bad"")"`);
 assert.equal(csvCell('\ufeff@danger'),JSON.stringify("'@danger"));
 assert.equal(csvCell('champ\r\nmultiligne'),JSON.stringify('champ  multiligne'));
});
