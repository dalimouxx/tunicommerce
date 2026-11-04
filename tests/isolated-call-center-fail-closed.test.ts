import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {projectTeamSection} from '../modules/shops/team-read';

const assignedTo='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
function fixture(){
 const s=initialState(false);
 s.products=[{id:'p',name:'Article',sku:'TEST',category:'Mode',variant:'',price:10000,cost:6000,
  stock:5,threshold:1,color:'#ffffff',active:true}];
 let next=applyAction(s,'createOrder',{name:'Nom personnel',phone:'22123456',city:'Gabès',
  address:'Adresse personnelle',source:'Boutique',items:[{productId:'p',quantity:1}]});
 next=applyAction(next,'assignCallAgent',{id:next.orders[0].id,agentId:assignedTo});
 return next;
}
test('CALL_CENTER without authenticated actor context receives no orders, never all',()=>{
 const state=fixture();
 const view=projectTeamSection(state,'CALL_CENTER','orders') as {orders:unknown[]};
 assert.deepEqual(view.orders,[]);
 const blank=projectTeamSection(state,'CALL_CENTER','orders','') as {orders:unknown[]};
 assert.deepEqual(blank.orders,[]);
 const owner=projectTeamSection(state,'CALL_CENTER','orders',assignedTo) as {orders:{customer?:unknown}[]};
 assert.equal(owner.orders.length,1);
 const otherAgent=projectTeamSection(state,'CALL_CENTER','orders',other) as {orders:unknown[]};
 assert.equal(otherAgent.orders.length,0);
});
test('non-privileged VIEWER order projection never includes buyer PII',()=>{
 const state=fixture();
 const view=projectTeamSection(state,'VIEWER','orders',other);
 const body=JSON.stringify(view);
 for(const secret of ['22123456','Nom personnel','Adresse personnelle'])assert.equal(body.includes(secret),false);
});
test('unknown role receives no orders',()=>{
 const view=projectTeamSection(fixture(),'NOT_A_ROLE','orders',other);
 assert.equal(view,null);
});
