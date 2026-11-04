import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {warehouseOverview,warehouseMutation} from '../modules/warehouse/ledger';
function fixture(){
 const s=initialState(false);
 s.products=[{id:'p',sku:'P-01',name:'Produit',category:'Général',variant:'',price:40000,cost:20000,stock:5,threshold:1,color:'#dddddd',active:true}];
 return s;
}
function locations(){
 let s=applyAction(fixture(),'initializeWarehouses',{});
 s=applyAction(s,'createWarehouse',{name:'Dépôt Sfax',code:'SFAX'});
 return s;
}
test('initialize without changing old total or historical product data',()=>{
 const s=fixture(),before=JSON.stringify(s);
 const activated=applyAction(s,'initializeWarehouses',{});
 assert.equal(activated.products[0].stock,5);
 assert.equal(warehouseOverview(activated).products[0].byLocation[0].quantity,5);
 assert.equal(activated.warehouses?.[0].id,'primary');
 assert.equal(JSON.stringify(s),before);
 assert.throws(()=>applyAction(activated,'initializeWarehouses',{}),/déjà initialisés/);
});
test('transfer is zero-sum, recorded with proof and isolated from other state',()=>{
 const s=locations(),before=JSON.stringify(s);
 const depot=s.warehouses![1].id;
 const transferred=applyAction(s,'transferWarehouseStock',{productId:'p',fromId:'primary',toId:depot,quantity:3,reference:'BON-TEST-01'});
 const row=warehouseOverview(transferred).products[0];
 assert.equal(row.total,5);
 assert.equal(row.byLocation.find(x=>x.warehouseId===depot)?.quantity,3);
 assert.equal(row.byLocation.find(x=>x.warehouseId==='primary')?.quantity,2);
 assert.equal(transferred.stockTransfers?.[0].reference,'BON-TEST-01');
 assert.equal(JSON.stringify(s),before);
 assert.throws(()=>applyAction(transferred,'transferWarehouseStock',{productId:'p',fromId:'primary',toId:depot,quantity:5,reference:'BON-TEST-02'}),/insuffisant/);
});
test('COD order reserves stock across locations; cancellation restores to main',()=>{
 let s=locations(),depot=s.warehouses![1].id;
 s=applyAction(s,'transferWarehouseStock',{productId:'p',fromId:'primary',toId:depot,quantity:4,reference:'BON-TEST-03'});
 const order=applyAction(s,'createOrder',{name:'Client',phone:'22123456',city:'Gabès',address:'Rue de test',source:'Boutique',
  items:[{productId:'p',quantity:3}]});
 assert.equal(order.products[0].stock,2);
 assert.equal(warehouseOverview(order).products[0].byLocation.find(x=>x.warehouseId===depot)?.quantity,2);
 const id=order.orders[0].id;
 const cancelled=applyAction(order,'transition',{id,status:'CANCELLED'});
 assert.equal(cancelled.products[0].stock,5);
 assert.equal(warehouseOverview(cancelled).products[0].byLocation.reduce((n,b)=>n+b.quantity,0),5);
 assert.equal(warehouseOverview(cancelled).inconsistencies.length,0);
});
test('returns, manual adjustment and new products synchronize with multi-depot balances',()=>{
 let s=locations(),depot=s.warehouses![1].id;
 s=applyAction(s,'stock',{id:'p',quantity:2,reason:'Achat fournisseur'});
 assert.equal(warehouseOverview(s).products[0].byLocation.reduce((n,b)=>n+b.quantity,0),7);
 s=applyAction(s,'transferWarehouseStock',{productId:'p',fromId:'primary',toId:depot,quantity:3,reference:'BON-TEST-04'});
 s=applyAction(s,'stock',{id:'p',quantity:-5,reason:'Inventaire physique'});
 assert.equal(warehouseOverview(s).products[0].total,2);
 assert.equal(warehouseOverview(s).inconsistencies.length,0);
 s=applyAction(s,'product',{name:'Nouveau',sku:'NEW',category:'Mode',variant:'',price:10000,cost:2000,stock:8,threshold:1,color:'#ffffff'});
 const fresh=s.products.find(x=>x.sku==='NEW')!;
 assert.equal(warehouseOverview(s).products.find(x=>x.id===fresh.id)?.byLocation[0].quantity,8);
});
test('mismatch blocks rather than silently modifying stocks',()=>{
 const s=locations();s.warehouseBalances![0].quantity=3;
 assert.equal(warehouseOverview(s).inconsistencies[0],'P-01');
 assert.throws(()=>applyAction(s,'stock',{id:'p',quantity:-1,reason:'Test'}),/Incohérence/);
});
test('strict input refuses forged location and negative transfers',()=>{
 const x={action:'transferWarehouseStock',requestId:crypto.randomUUID(),payload:{
  productId:'p',fromId:'primary',toId:crypto.randomUUID(),quantity:1,reference:'BON-123'}};
 assert.equal(warehouseMutation.safeParse(x).success,true);
 assert.equal(warehouseMutation.safeParse({...x,payload:{...x.payload,quantity:-1}}).success,false);
 assert.equal(warehouseMutation.safeParse({...x,payload:{...x.payload,ownerId:'attacker'}}).success,false);
});
