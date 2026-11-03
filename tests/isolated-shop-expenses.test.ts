import test from 'node:test';
import assert from 'node:assert/strict';
import {expenseMutation,expenseDateIsValid} from '../modules/shops/expenses';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';

test('strict mutation accepts positive integer millimes and validated date',()=>{
 const input=expenseMutation.parse({action:'expense',requestId:'55555555-5555-4555-8555-555555555555',payload:{
  label:'Emballage',category:'Fonctionnement',amount:4500,date:'2026-11-03'
 }});
 assert.equal(input.payload.amount,4500);
 assert.equal(expenseDateIsValid(input.payload.date),true);
 assert.equal(expenseDateIsValid('2026-02-30'),false);
});
test('rejects negative amounts, foreign actions and extra fields',()=>{
 const base={action:'expense',requestId:'55555555-5555-4555-8555-555555555555',payload:{
  label:'Emballage',category:'Fonctionnement',amount:-1,date:'2026-11-03'
 }};
 assert.equal(expenseMutation.safeParse(base).success,false);
 assert.equal(expenseMutation.safeParse({...base,action:'reset'}).success,false);
 assert.equal(expenseMutation.safeParse({...base,payload:{...base.payload,amount:100,admin:true}}).success,false);
});
test('isolated expense action does not mutate other stores or input',()=>{
 const state=initialState(false);
 const updated=applyAction(state,'expense',{label:'Carton',category:'Emballage',amount:3000,date:'2026-11-03'});
 assert.equal(state.expenses.length,0);
 assert.equal(updated.expenses.length,1);
 assert.equal(updated.expenses[0]?.amount,3000);
});
