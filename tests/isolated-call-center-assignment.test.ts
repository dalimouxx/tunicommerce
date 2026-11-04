import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {projectTeamSection} from '../modules/shops/team-read';
import {teamWriteInput,validateCallNote,validateCallTransition} from '../modules/shops/team-actions';
import {callCenterAssignmentInput} from '../modules/shops/call-center-assignment';

const agent='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
function fixture(){
 const s=initialState(false);
 s.products=[{id:'p',name:'Produit',sku:'SKU',category:'Général',variant:'',price:25000,cost:4000,
  stock:5,threshold:1,color:'#111111',active:true}];
 return applyAction(s,'createOrder',{name:'Client privé',phone:'22123456',city:'Tunis',address:'Rue du centre',
  source:'Boutique',items:[{productId:'p',quantity:1}]});
}
test('assignment persists in isolated order and can be cleared with audit',()=>{
 let state=fixture();
 const orderId=state.orders[0].id;
 state=applyAction(state,'assignCallAgent',{id:orderId,agentId:agent});
 assert.equal(state.orders[0].assignedAgentId,agent);
 assert.equal(state.orders[0].status,'TO_CONFIRM');
 const visible=projectTeamSection(state,'CALL_CENTER','orders',agent) as {orders:{id:string}[]};
 assert.equal(visible.orders.length,1);
 const invisible=projectTeamSection(state,'CALL_CENTER','orders',other) as {orders:{id:string}[]};
 assert.equal(invisible.orders.length,0);
 state=applyAction(state,'assignCallAgent',{id:orderId,agentId:null});
 assert.equal(state.orders[0].assignedAgentId,undefined);
 assert.equal((projectTeamSection(state,'CALL_CENTER','orders',other) as {orders:unknown[]}).orders.length,1);
});
test('employees cannot confirm or annotate another agents assignment',()=>{
 const assigned=fixture();
 const next=applyAction(assigned,'assignCallAgent',{id:assigned.orders[0].id,agentId:agent});
 const confirm=teamWriteInput.parse({action:'confirmOrder',requestId:crypto.randomUUID(),
  payload:{id:next.orders[0].id,status:'CONFIRMED'}});
 const note=teamWriteInput.parse({action:'callNote',requestId:crypto.randomUUID(),
  payload:{id:next.orders[0].id,note:'Appel tenté à 11h'}});
 if(confirm.action!=='confirmOrder'||note.action!=='callNote')throw Error('Invalid fixture');
 assert.throws(()=>validateCallTransition(next,confirm,other),/autre agent/);
 assert.throws(()=>validateCallNote(next,note,other),/autre agent/);
 assert.doesNotThrow(()=>validateCallTransition(next,confirm,agent));
 assert.doesNotThrow(()=>validateCallNote(next,note,agent));
});
test('strict assignment payload rejects extra properties',()=>{
 assert.equal(callCenterAssignmentInput.safeParse({requestId:crypto.randomUUID(),orderId:crypto.randomUUID(),agentId:agent}).success,true);
 assert.equal(callCenterAssignmentInput.safeParse({requestId:crypto.randomUUID(),orderId:crypto.randomUUID(),agentId:agent,force:true}).success,false);
});
