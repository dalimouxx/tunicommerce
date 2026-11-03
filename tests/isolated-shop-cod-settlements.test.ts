import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {codBalances,codSettlementHistory,codSettlementMutation} from '../modules/shops/cod-settlements';

function fixture(){
 const s=initialState(false);
 s.orders=[{id:'order-1',reference:'TC-1001',customerId:'c1',items:[],status:'DELIVERED',
  source:'Manuel',subtotal:20000,discount:0,shipping:0,deliveryCost:0,total:20000,collected:0,
  carrier:'',tracking:'',notes:'',createdAt:'2026-11-03T08:00:00.000Z',
  updatedAt:'2026-11-03T08:00:00.000Z',callbackAt:'',events:[]}];
 return s;
}
test('COD partial payments accumulate without exceeding total',()=>{
 const original=fixture();
 const first=applyAction(original,'settlement',{id:'order-1',amount:7000,reference:'R1'});
 const second=applyAction(first,'settlement',{id:'order-1',amount:5000,reference:'R2'});
 assert.equal(original.orders[0].collected,0);
 assert.equal(codBalances(second)[0].remainingMillimes,8000);
 assert.equal(codSettlementHistory(second).length,2);
 assert.throws(()=>applyAction(second,'settlement',{id:'order-1',amount:8001,reference:'R3'}),/dépasse/);
});
test('strict endpoint payload rejects unrelated actions and extra fields',()=>{
 const ok={action:'settlement',requestId:'11111111-1111-4111-8111-111111111111',
  payload:{id:'order-1',amount:1000,reference:'Ref'}};
 assert.equal(codSettlementMutation.safeParse(ok).success,true);
 assert.equal(codSettlementMutation.safeParse({...ok,action:'reset'}).success,false);
 assert.equal(codSettlementMutation.safeParse({...ok,payload:{...ok.payload,admin:true}}).success,false);
});
test('cannot settle non-delivered orders',()=>{
 const s=fixture();s.orders[0].status='SHIPPED';
 assert.throws(()=>applyAction(s,'settlement',{id:'order-1',amount:1000,reference:'R'}),/non livrée/);
});
