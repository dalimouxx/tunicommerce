import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {requiredTeamPermission,teamWriteInput,validateCallTransition,validateCallNote} from '../modules/shops/team-actions';
import {canAccessShop} from '../modules/shops/permissions';

const uuid='123e4567-e89b-42d3-a456-426614174123';
const orderId='123e4567-e89b-42d3-a456-426614174124';
function sample(){
 let state=applyAction(initialState(false),'product',{
  name:'Produit pilote',sku:'PILOT-1',category:'Mode',variant:'',price:20000,cost:10000,
  stock:4,threshold:1,color:'#aabbcc'
 });
 state=applyAction(state,'createOrder',{
  name:'Client test',phone:'22123456',city:'Gabès',address:'Rue des tests',
  source:'Manuel',items:[{productId:state.products[0].id,quantity:1}]
 });
 return state;
}
test('team write permissions are narrow and fail closed',()=>{
 assert.equal(canAccessShop('STOCK',requiredTeamPermission('adjustStock')),true);
 assert.equal(canAccessShop('STOCK',requiredTeamPermission('confirmOrder')),false);
 assert.equal(canAccessShop('CALL_CENTER',requiredTeamPermission('confirmOrder')),true);
 assert.equal(canAccessShop('VIEWER',requiredTeamPermission('confirmOrder')),false);
 assert.equal(canAccessShop('ACCOUNTANT',requiredTeamPermission('adjustStock')),false);
});
test('strict payload validation blocks arbitrary operations',()=>{
 const p={id:orderId,status:'CANCELLED'};
 assert.equal(teamWriteInput.safeParse({action:'confirmOrder',requestId:uuid,payload:p}).success,false);
 assert.equal(teamWriteInput.safeParse({action:'settlement',requestId:uuid,payload:{}}).success,false);
 assert.equal(teamWriteInput.safeParse({action:'adjustStock',requestId:uuid,payload:{id:orderId,quantity:0,reason:'Inventaire'}}).success,false);
 assert.equal(teamWriteInput.safeParse({action:'callNote',requestId:uuid,payload:{id:orderId,note:'Note',privateData:true}}).success,false);
});
test('only initial confirmation statuses are available to Call Center',()=>{
 const s=sample();const id=s.orders[0].id;
 assert.doesNotThrow(()=>validateCallTransition(s,{action:'confirmOrder',requestId:uuid,payload:{id,status:'CONFIRMED'}}));
 assert.throws(()=>validateCallTransition(s,{action:'confirmOrder',requestId:uuid,payload:{id,status:'CALLBACK'}}));
 const confirmed=applyAction(s,'transition',{id,status:'CONFIRMED'});
 assert.throws(()=>validateCallTransition(confirmed,{action:'confirmOrder',requestId:uuid,payload:{id,status:'NO_ANSWER'}}));
 assert.throws(()=>validateCallNote(confirmed,{action:'callNote',requestId:uuid,payload:{id,note:'Appel du client'}}));
});
