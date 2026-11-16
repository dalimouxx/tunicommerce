import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {splitHistory,HISTORY_WINDOW} from '../modules/commerce/history';

function withHistory(audit:number,movements:number){
 const s=initialState(true);
 s.audit=Array.from({length:audit},(_,i)=>({id:'a'+i,at:new Date(Date.UTC(2026,0,1)+(audit-i)*60000).toISOString(),label:'Action '+i}));
 s.movements=Array.from({length:movements},(_,i)=>({id:'m'+i,productId:'p1',label:'Mouvement '+i,quantity:i%2?1:-1,at:new Date(Date.UTC(2026,0,1)+(movements-i)*60000).toISOString()}));
 return s;
}
test('every entry is handed over for storage and the block keeps the newest window',()=>{
 const s=withHistory(450,260);
 const before=JSON.stringify({orders:s.orders,products:s.products,customers:s.customers});
 const {state,journal,movements}=splitHistory(s);
 assert.equal(HISTORY_WINDOW,200);
 assert.equal(journal.length,450);assert.equal(movements.length,260);
 assert.equal(state.audit.length,200);assert.equal(state.movements.length,200);
 assert.deepEqual(state.audit.map(x=>x.id),s.audit.slice(0,200).map(x=>x.id),'newest first is kept');
 assert.equal(JSON.stringify({orders:state.orders,products:state.products,customers:state.customers}),before,'business data untouched');
 assert.equal(s.audit.length,450,'input not mutated');
});
test('small histories are stored but not trimmed, and malformed entries are skipped',()=>{
 const s=withHistory(5,3);
 (s.audit as unknown[]).push({id:'',at:'x',label:'cassé'},null);
 const {state,journal,movements}=splitHistory(s);
 assert.equal(state.audit.length,7,'window not reached: nothing removed');
 assert.equal(journal.length,5);assert.equal(movements.length,3);
});
