import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {warehouseOverview} from '../modules/warehouse/ledger';
function sample(){
 const state=initialState(false);
 state.products=[{id:'p',sku:'T-01',name:'Produit',category:'Mode',variant:'',price:12000,cost:5000,
  stock:6,threshold:1,color:'#ffffff',active:true}];
 return state;
}
const customer={name:'Client',phone:'22123456',city:'Gabès',address:'Rue',source:'Boutique' as const,
 items:[{productId:'p',quantity:4}]};
function withLocations(){
 let s=applyAction(sample(),'initializeWarehouses',{});
 s=applyAction(s,'createWarehouse',{name:'Dépôt nord',code:'NORD'});
 const secondary=s.warehouses![1].id;
 s=applyAction(s,'transferWarehouseStock',{productId:'p',fromId:'primary',toId:secondary,quantity:5,reference:'BON-PHYSIQUE-01'});
 return {s,secondary};
}
test('reservation records exact origin and cancellation restores into original bins',()=>{
 const {s,secondary}=withLocations();
 let next=applyAction(s,'createOrder',customer),id=next.orders[0].id;
 const picks=next.warehousePicks!.filter(x=>x.orderId===id);
 assert.equal(picks.length,2);
 assert.equal(picks.find(x=>x.warehouseId==='primary')?.quantity,1);
 assert.equal(picks.find(x=>x.warehouseId===secondary)?.quantity,3);
 assert.equal(next.products[0].stock,2);
 assert.equal(warehouseOverview(next).picks.length,2);
 next=applyAction(next,'transition',{id,status:'CANCELLED'});
 const allocations=warehouseOverview(next).products[0].byLocation;
 assert.equal(allocations.find(x=>x.warehouseId==='primary')?.quantity,1);
 assert.equal(allocations.find(x=>x.warehouseId===secondary)?.quantity,5);
 assert.equal(next.products[0].stock,6);
 assert.equal(warehouseOverview(next).picks.length,0);
 assert.equal(next.warehousePicks!.filter(x=>x.returnedAt).length,2);
});
test('historic unallocated orders remain cancelable after warehouse activation',()=>{
 let s=sample();
 s=applyAction(s,'createOrder',customer);const id=s.orders[0].id;
 s=applyAction(s,'initializeWarehouses',{});
 assert.equal(s.warehousePicks?.length||0,0);
 s=applyAction(s,'transition',{id,status:'CANCELLED'});
 assert.equal(s.products[0].stock,6);
 assert.equal(warehouseOverview(s).inconsistencies.length,0);
 assert.equal(warehouseOverview(s).products[0].byLocation[0].quantity,6);
});
test('mismatched reservation origin blocks cancellation atomically',()=>{
 const {s}=withLocations();const created=applyAction(s,'createOrder',customer),id=created.orders[0].id;
 const corrupt=structuredClone(created);corrupt.warehousePicks![0].quantity=100;
 const before=JSON.stringify(corrupt);
 assert.throws(()=>applyAction(corrupt,'transition',{id,status:'CANCELLED'}),/incohérente/);
 assert.equal(JSON.stringify(corrupt),before);
});
test('product stock and pick location lists never expose buyer address or phone',()=>{
 const {s}=withLocations();const created=applyAction(s,'createOrder',customer);
 const projection=JSON.stringify(warehouseOverview(created));
 for(const secret of ['22123456','Rue','Client'])assert.equal(projection.includes(secret),false);
});
