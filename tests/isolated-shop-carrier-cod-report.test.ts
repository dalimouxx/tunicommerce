import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {carrierCodReport} from '../modules/shops/carrier-cod-report';
import type {Order} from '../modules/commerce/types';

function order(id:string,carrier:string,status:Order['status'],total:number,collected:number):Order{
 return {id,reference:'TC-'+id,customerId:'private',items:[],status,source:'Manuel',
  subtotal:total,discount:0,shipping:0,deliveryCost:0,total,collected,
  carrier,tracking:'',notes:'',createdAt:'2026-11-03T08:00:00.000Z',
  updatedAt:'2026-11-03T08:00:00.000Z',callbackAt:'',events:[]};
}

test('groups only delivered orders and linked settlements without leaking customers',()=>{
 const state=initialState(false);
 state.orders=[
  order('1','Transport A','DELIVERED',20000,12000),
  order('2','Transport A','DELIVERED',10000,0),
  order('3','Transport B','DELIVERED',7000,7000),
  order('4','Transport A','SHIPPED',50000,0)
 ];
 state.settlements=[
  {id:'s1',orderId:'1',amount:12000,reference:'RECU-1',at:'2026-11-03T08:00:00.000Z'},
  {id:'s2',orderId:'4',amount:50000,reference:'NOT-DELIVERED',at:'2026-11-03T08:00:00.000Z'}
 ];
 const result=carrierCodReport(state);
 assert.equal(result.length,2);
 assert.deepEqual(result[0],{
  carrier:'Transport A',deliveredOrders:2,deliveredGrossMillimes:30000,collectedMillimes:12000,
  outstandingMillimes:18000,recordedSettlements:1,settlementAmountsMillimes:12000
 });
 assert.equal(result[1]?.outstandingMillimes,0);
 assert.equal(JSON.stringify(result).includes('private'),false);
 assert.equal(JSON.stringify(result).includes('RECU-1'),false);
});

test('unknown carrier is explicitly unassigned, not attributed to a partner',()=>{
 const state=initialState(false);
 state.orders=[order('1',' ','DELIVERED',1000,0)];
 assert.equal(carrierCodReport(state)[0]?.carrier,'Transporteur non renseigné');
 assert.deepEqual(carrierCodReport(initialState(false)),[]);
});
