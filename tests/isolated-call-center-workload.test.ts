import test from 'node:test';
import assert from 'node:assert/strict';
import {callCenterWorkload,suggestCallCenterAgent} from '../modules/shops/call-center-workload';

const agents=[
 {id:'c',name:'Agent C',role:'CALL_CENTER',active:true},
 {id:'a',name:'Agent A',role:'CALL_CENTER',active:true},
 {id:'b',name:'Agent B',role:'MANAGER',active:true},
 {id:'inactive',name:'Inactive',role:'CALL_CENTER',active:false},
 {id:'viewer',name:'Viewer',role:'VIEWER',active:true}
];
const now=new Date('2026-11-04T12:00:00Z');
test('owner summary counts only confirmation queue and never assigns automatically',()=>{
 const orders=[
  {id:'1',status:'TO_CONFIRM',createdAt:'2026-11-04T10:00:00Z',assignedAgentId:'a'},
  {id:'2',status:'NO_ANSWER',createdAt:'2026-11-04T10:00:00Z',assignedAgentId:'a'},
  {id:'3',status:'CALLBACK',createdAt:'2026-11-04T10:00:00Z',callbackAt:'2026-11-03T10:00:00Z',assignedAgentId:'c'},
  {id:'4',status:'TO_CONFIRM',createdAt:'2026-11-04T10:00:00Z'},
  {id:'5',status:'DELIVERED',createdAt:'2026-11-04T10:00:00Z',assignedAgentId:'b'}
 ];
 const before=JSON.stringify(orders);
 const summary=callCenterWorkload(orders,agents,now);
 assert.equal(summary.total,4);
 assert.equal(summary.unassigned,1);
 assert.equal(summary.overdue,1);
 assert.deepEqual(summary.agents.map(a=>[a.id,a.assigned,a.overdue]),[['b',0,0],['c',1,1],['a',2,0]]);
 assert.equal(suggestCallCenterAgent(orders,agents,now),'b');
 assert.equal(JSON.stringify(orders),before);
});
test('exclude inactive/non-agent members and no invented suggestion',()=>{
 assert.equal(suggestCallCenterAgent([],agents.filter(a=>!a.active||a.role==='VIEWER'),now),null);
 assert.equal(callCenterWorkload([],[],now).unassigned,0);
});
test('stable tie-breaking chooses same agent regardless of input order',()=>{
 const orders=[] as {id:string;status:string;createdAt:string}[];
 assert.equal(suggestCallCenterAgent(orders,[agents[0],agents[1]],now),'a');
});
