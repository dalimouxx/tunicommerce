import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {teamCanView,projectTeamSection} from '../modules/shops/team-read';

function sample(){
 let state=applyAction(initialState(false),'product',{
  name:'Produit test',sku:'SKU-10',category:'Mode',variant:'',price:20000,cost:10000,
  stock:4,threshold:1,color:'#aabbcc'
 });
 state=applyAction(state,'createOrder',{
  name:'Acheteur sensible',phone:'22123456',city:'Tunis',address:'Adresse privée',
  source:'Manuel',items:[{productId:state.products[0].id,quantity:1}]
 });
 return state;
}
test('roles only receive entitled data sections',()=>{
 assert.equal(teamCanView('STOCK','products'),true);
 assert.equal(teamCanView('STOCK','finance'),false);
 assert.equal(teamCanView('CALL_CENTER','orders'),true);
 assert.equal(teamCanView('CALL_CENTER','finance'),false);
 assert.equal(teamCanView('ACCOUNTANT','finance'),true);
 assert.equal(teamCanView('ACCOUNTANT','products'),false);
 assert.equal(teamCanView('VIEWER','finance'),false);
 assert.equal(teamCanView('unknown','orders'),false);
});
test('viewer order projection excludes customer and money while call center includes contact only',()=>{
 const state=sample();
 const viewer=projectTeamSection(state,'VIEWER','orders')!;
 const callCenter=projectTeamSection(state,'CALL_CENTER','orders')!;
 const viewerText=JSON.stringify(viewer);
 const callText=JSON.stringify(callCenter);
 assert.ok(!viewerText.includes('22123456'));
 assert.ok(!viewerText.includes('Acheteur sensible'));
 assert.ok(!viewerText.includes('Adresse privée'));
 assert.ok(!viewerText.includes('"total"'));
 assert.ok(callText.includes('22123456'));
 assert.ok(!callText.includes('Adresse privée'));
 assert.ok(!callText.includes('"total"'));
});
test('stock projection does not disclose purchase cost or buyer records',()=>{
 const view=projectTeamSection(sample(),'STOCK','products')!;
 assert.ok(!JSON.stringify(view).includes('10000'));
 assert.ok(!JSON.stringify(view).includes('22123456'));
});
test('finance projection offers only totals and no customer details',()=>{
 const view=projectTeamSection(sample(),'ACCOUNTANT','finance')!;
 assert.ok(view);
 const content=JSON.stringify(view);
 assert.ok(content.includes('codOutstandingMillimes'));
 assert.ok(!content.includes('22123456'));
 assert.ok(!content.includes('Acheteur sensible'));
});
