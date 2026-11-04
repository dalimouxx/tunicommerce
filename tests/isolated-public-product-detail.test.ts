import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {publicProductDetail} from '../modules/shops/public-product-detail';

function catalog(){
 const state=initialState(false);
 state.shop.name='Boutique privée';
 state.shop.phone='22123456';
 state.products=[
  {id:'p1',name:'Chemise',sku:'S-01',category:'Mode',variant:'Rouge',price:45000,cost:23000,
   stock:2,threshold:1,color:'#ffffff',active:true,description:'Chemise coton'},
  {id:'p2',name:'Pantalon',sku:'S-02',category:'Mode',variant:'Noir',price:85000,cost:35000,
   stock:5,threshold:1,color:'#ffffff',active:true},
  {id:'p3',name:'Éteint',sku:'S-03',category:'Mode',variant:'',price:20000,cost:10000,
   stock:8,threshold:1,color:'#ffffff',active:false}
 ];
 return state;
}
test('public product projection does not reveal SKU, cost, customer data or stock quantities',()=>{
 const state=catalog(),detail=publicProductDetail(state,'p1');
 assert.ok(detail);
 assert.equal(detail!.product.price,45000);
 assert.equal(detail!.store.theme.code,'OASIS');
 assert.equal(detail!.similar.length,1);
 assert.equal(detail!.similar[0].id,'p2');
 const json=JSON.stringify(detail);
 for(const secret of ['23000','S-01','22123456','threshold','stock','customers'])
  assert.equal(json.includes(secret),false);
});
test('unpublished product is not projected and out-of-stock product remains unavailable',()=>{
 const state=catalog();
 assert.equal(publicProductDetail(state,'p3'),null);
 assert.equal(publicProductDetail(state,'not-exists'),null);
 state.products[0].stock=0;
 const detail=publicProductDetail(state,'p1');
 assert.equal(detail?.product.available,false);
});
