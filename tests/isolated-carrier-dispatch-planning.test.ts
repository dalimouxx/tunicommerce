import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {eligibleCarriers,dispatchPrintRows,dispatchPrintPage,parseDispatchPrintQuery} from '../modules/shops/carrier-dispatch-planner';
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

test('P3 printable dispatch includes all READY/SHIPPED orders across multiple bounded pages',()=>{
 const state=initialState(false);
 const dummy={id:'dummy',reference:'TC-DUMMY',status:'READY',total:12000,carrier:'',
  tracking:'',customerId:'missing',customerSnapshot:{name:'Client privé',phone:'22123456',city:'Gabès',address:'Rue confidentielle'},
  items:[{name:'Article',variant:'Noir',quantity:1}]};
 state.orders=Array.from({length:96},(_,i)=>({...dummy,id:'print-'+i,
  reference:'TC-'+i,status:i%2===0?'READY':'SHIPPED'})) as never;
 const first=dispatchPrintPage(state,{page:1,status:'ALL'});
 const second=dispatchPrintPage(state,{page:2,status:'ALL'});
 const third=dispatchPrintPage(state,{page:3,status:'ALL'});
 assert.deepEqual([first.rows.length,second.rows.length,third.rows.length],[40,40,16]);
 assert.deepEqual([first.total,first.totalPages],[96,3]);
 assert.equal(new Set([...first.rows,...second.rows,...third.rows].map(row=>row.reference)).size,96);
 assert.equal(dispatchPrintRows(state).length,40);
 const ready=dispatchPrintPage(state,{page:2,status:'READY'});
 assert.equal(ready.total,48);
 assert.equal(ready.rows.length,8);
 assert.equal(ready.rows.every(row=>row.status==='READY'),true);
 assert.equal(ready.rows[0].address,'Rue confidentielle');
 assert.throws(()=>dispatchPrintPage(state,{page:4,status:'ALL'}),/introuvable/);
});
test('P1/P3 printable dispatch query refuses duplicated, oversized and unknown values',()=>{
 assert.deepEqual(parseDispatchPrintQuery({page:'2',status:'SHIPPED'}),{page:2,status:'SHIPPED'});
 for(const invalid of [{page:'0'},{page:'10000'},{page:'-1'},
  {status:'DELIVERED'},{status:['ALL','READY']},{page:['1','2']},
  {status:'ALL',redirect:'evil'}])
  assert.throws(()=>parseDispatchPrintQuery(invalid));
});
