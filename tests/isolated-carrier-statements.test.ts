import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {carrierStatementMutation,carrierStatementsView} from '../modules/shops/carrier-statements';

function fixture(){
 const s=initialState(false);
 s.products=[{id:'p',sku:'SKU-PRIVATE',name:'Article',category:'Mode',variant:'',
  price:20000,cost:7000,stock:5,threshold:1,color:'#ffffff',active:true}];
 const ordered=applyAction(s,'createOrder',{name:'Client secret',phone:'22123456',
  city:'Gabès',address:'Adresse privée',source:'Boutique',items:[{productId:'p',quantity:1}]});
 ordered.orders[0].status='DELIVERED';
 ordered.orders[0].carrier='Express A';
 return ordered;
}
test('declaration and actual COD settlements are tracked separately',()=>{
 const s=fixture();
 const settled=applyAction(s,'settlement',{id:s.orders[0].id,amount:5000,reference:'PAYER-01'});
 const next=applyAction(settled,'recordCarrierStatement',{orderId:s.orders[0].id,
  amount:7000,reference:'BORD-01',date:'2026-11-03'});
 const row=carrierStatementsView(next).orders[0];
 assert.equal(row.recordedSettlementsMillimes,5000);
 assert.equal(row.declaredStatementsMillimes,7000);
 assert.equal(row.declarationGapMillimes,2000);
 assert.equal(next.orders[0].collected,5000);
 assert.equal(s.carrierStatements?.length||0,0);
 assert.equal(JSON.stringify(carrierStatementsView(next)).includes('22123456'),false);
 assert.throws(()=>applyAction(next,'recordCarrierStatement',{orderId:s.orders[0].id,
  amount:7000,reference:'BORD-01',date:'2026-11-03'}),/existe déjà/);
});
test('statement requires delivered order and real ISO date',()=>{
 const s=fixture();
 s.orders[0].status='SHIPPED';
 assert.throws(()=>applyAction(s,'recordCarrierStatement',{orderId:s.orders[0].id,
  amount:1000,reference:'BORD-02',date:'2026-11-03'}),/livrée/);
 s.orders[0].status='DELIVERED';
 assert.throws(()=>applyAction(s,'recordCarrierStatement',{orderId:s.orders[0].id,
  amount:1000,reference:'BORD-02',date:'2026-02-30'}),/Date de bordereau/);
});
test('strict document request validation',()=>{
 const input={action:'recordCarrierStatement',requestId:'55555555-5555-4555-8555-555555555555',
  payload:{orderId:'id',reference:'BORD',amount:1000,date:'2026-11-03'}};
 assert.equal(carrierStatementMutation.safeParse(input).success,true);
 assert.equal(carrierStatementMutation.safeParse({...input,payload:{...input.payload,collected:true}}).success,false);
});
