import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {isolatedStorefrontPreview} from '../modules/shops/storefront-preview';

test('preview only exposes active products and never their cost, SKU or stock quantity',()=>{
 const state=initialState(false);
 state.shop.name='Boutique A';
 state.products=[
  {id:'one',name:'Produit disponible',sku:'PRIVATE-SKU',category:'Mode',variant:'Noir',
   price:15000,cost:9000,stock:3,threshold:1,color:'#ffffff',active:true},
  {id:'hidden',name:'Produit masqué',sku:'HIDDEN',category:'Mode',variant:'',
   price:25000,cost:1000,stock:4,threshold:1,color:'#ffffff',active:false},
  {id:'empty',name:'Article épuisé',sku:'EMPTY',category:'Maison',variant:'',
   price:19000,cost:11000,stock:0,threshold:1,color:'#ffffff',active:true}
 ];
 state.customers=[{id:'c',name:'Donnée client privée',phone:'22123456',city:'Gabès',address:'Adresse',notes:'Notes'}];
 const result=isolatedStorefrontPreview(state);
 assert.equal(result.name,'Boutique A');
 assert.equal(result.products.length,2);
 assert.equal(result.products[0]?.available,true);
 assert.equal(result.products[1]?.available,false);
 const serialized=JSON.stringify(result);
 for(const secret of ['PRIVATE-SKU','HIDDEN','22123456','Donnée client privée','Adresse','Notes','cost','stock'])assert.equal(serialized.includes(secret),false);
});

test('empty shop preview remains a valid catalog',()=>{
 assert.deepEqual(isolatedStorefrontPreview(initialState(false)).products,[]);
});
