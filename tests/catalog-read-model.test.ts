import test from 'node:test';
import assert from 'node:assert/strict';
import type {ShopCatalogProduct} from '@prisma/client';
import type {Product} from '../modules/commerce/types';
import {catalogProductRecord,catalogProductValue} from '../modules/shops/catalog-product';
import {catalogQuery,catalogSearch,catalogMatches,catalogPage} from '../modules/shops/catalog-query';
const product:Product={id:'p1',name:'Édition jeune',sku:'100%_A',category:'Mode',variant:'قميص',price:1001,cost:501,stock:0,threshold:2,color:'#abcdef',active:true,
 description:'Texte conservé',imageUrl:'https://example.test/photo.png',quantityOffers:[{quantity:2,price:900,label:'Duo'}]};
test('Normalized catalog products preserve exact money, optional values and extensions',()=>{
 const original={...product,futureField:{sizes:['S','M']}};
 const record=catalogProductRecord('shop1',original,0) as ShopCatalogProduct;
 assert.equal(record.price,BigInt(1001));assert.equal(record.lowStock,true);
 assert.deepEqual(catalogProductValue(record),original);
 const bare={...product};delete bare.description;delete bare.imageUrl;delete bare.quantityOffers;
 assert.deepEqual(catalogProductValue(catalogProductRecord('shop1',bare,1) as ShopCatalogProduct),bare);
});
test('Unsafe integers and malformed historical values cannot silently change during indexing',()=>{
 for(const value of [0.5,-1,Number.MAX_SAFE_INTEGER+1,Infinity,NaN])
  assert.throws(()=>catalogProductRecord('shop1',{...product,price:value},0));
 const row=catalogProductRecord('shop1',product,0) as ShopCatalogProduct;row.price=BigInt(Number.MAX_SAFE_INTEGER)+BigInt(1);
 assert.throws(()=>catalogProductValue(row));
});
test('Search supports accents, literal percent/underscore and Arabic',()=>{
 assert.equal(catalogSearch('ÉDITION'),'edition');
 for(const q of ['edition','ÉDItIon','100%_','قميص'])assert.equal(catalogMatches(product,catalogQuery.parse({q})),true);
 assert.equal(catalogMatches(product,catalogQuery.parse({q:'100X_'})),false);
});
test('Inactive products never enter replenishment or out-of-stock results',()=>{
 assert.equal(catalogMatches(product,catalogQuery.parse({stock:'out'})),true);
 assert.equal(catalogMatches({...product,active:false},catalogQuery.parse({stock:'low'})),false);
 assert.equal(catalogMatches(product,catalogQuery.parse({status:'inactive'})),false);
});
test('Query bounds and empty/late pagination cannot cause unbounded reads',()=>{
 for(const query of [{pageSize:101},{page:0},{page:-1},{q:'x'.repeat(101)},{includeSecrets:true}])assert.equal(catalogQuery.safeParse(query).success,false);
 assert.deepEqual(catalogPage(0,catalogQuery.parse({page:10})),{total:0,page:1,pages:1,pageSize:40,offset:0});
 assert.deepEqual(catalogPage(83,catalogQuery.parse({page:100})),{total:83,page:3,pages:3,pageSize:40,offset:80});
});
