import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {eligibleCarriers,dispatchPrintRows} from '../modules/shops/carrier-dispatch-planner';
import {carrierConfigurationInput} from '../modules/shops/carrier-configuration';

test('only active and destination-compatible carriers appear, cheapest first',()=>{
 const state=initialState(false);
 state.carriers=[
  {id:'a',name:'Cher',phone:'',governorates:['Gabès'],deliveryCost:9000,returnCost:4000,active:true},
  {id:'b',name:'Moins cher',phone:'',governorates:['Gabès'],deliveryCost:5000,returnCost:3000,active:true},
  {id:'c',name:'Hors zone',phone:'',governorates:['Tunis'],deliveryCost:1000,returnCost:0,active:true},
  {id:'d',name:'Inactif',phone:'',governorates:['Gabès'],deliveryCost:2000,returnCost:0,active:false}
 ];
 assert.deepEqual(eligibleCarriers(state,'Gabès').map(c=>c.id),['b','a']);
 assert.deepEqual(eligibleCarriers(state,'Sfax'),[]);
});
test('private labels include only ready/shipped and show COD and actual buyer address',()=>{
 const state=initialState(false);
 state.products=[{id:'p',name:'Produit',sku:'P',category:'Général',variant:'',price:12000,cost:2000,
  stock:4,threshold:1,color:'#dddddd',active:true}];
 let next=applyAction(state,'createOrder',{name:'Client Test',phone:'22123456',city:'Gabès',address:'Rue des palmiers',source:'Boutique',items:[{productId:'p',quantity:1}]});
 assert.equal(dispatchPrintRows(next).length,0);
 const id=next.orders[0].id;
 for(const status of ['CONFIRMED','PREPARING','READY'] as const)next=applyAction(next,'transition',{id,status});
 const printed=dispatchPrintRows(next);
 assert.equal(printed.length,1);
 assert.equal(printed[0].address,'Rue des palmiers');
 assert.equal(printed[0].codMillimes,next.orders[0].total);
 assert.equal(JSON.stringify(printed).includes('SKU'),false);
 next=applyAction(next,'transition',{id,status:'SHIPPED',carrier:'Manuel',tracking:'TRK-1'});
 assert.equal(dispatchPrintRows(next).length,1);
 next=applyAction(next,'transition',{id,status:'DELIVERED'});
 assert.equal(dispatchPrintRows(next).length,0);
});
test('carrier registry rejects duplicate regions and invalid amounts',()=>{
 const valid={action:'saveCarrier',requestId:crypto.randomUUID(),payload:{
  name:'Livreur local',phone:'22123456',governorates:['Gabès'],deliveryCost:5000,returnCost:1000,active:true
 }};
 assert.equal(carrierConfigurationInput.safeParse(valid).success,true);
 assert.equal(carrierConfigurationInput.safeParse({...valid,payload:{...valid.payload,governorates:['Gabès','Gabès']}}).success,false);
 assert.equal(carrierConfigurationInput.safeParse({...valid,payload:{...valid.payload,deliveryCost:-1}}).success,false);
});
