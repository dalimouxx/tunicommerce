import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {isolatedStorefrontPreview} from '../modules/shops/storefront-preview';
import {publicProductDetail} from '../modules/shops/public-product-detail';
import {catalogCategories,publicProductImageUrl,selectCatalogProducts} from '../modules/shops/public-catalog-filters';
import type {CatalogProduct} from '../modules/shops/public-catalog-filters';

const products:CatalogProduct[]=[
 {id:'a',name:'Téléphone blanc',category:'Électronique',variant:'64 Go',price:720000,
  description:'Modèle vitrine',imageUrl:'/api/media/products/11111111-1111-4111-8111-111111111111',available:true},
 {id:'b',name:'Robe noire',category:'Vêtements',variant:'M',price:85000,
  description:'Coton',imageUrl:'https://cdn.example.test/image.jpg',available:false},
 {id:'c',name:'Téléphone rouge',category:'Électronique',variant:'128 Go',price:650000,
  description:'Autre article',imageUrl:'',available:true}
];
test('P2 catalogue : recherche accentuée, catégorie, disponibilité et tri sans mutation',()=>{
 assert.deepEqual(catalogCategories(products),['Électronique','Vêtements']);
 const filtered=selectCatalogProducts(products,{search:'telephone',category:'Électronique',availableOnly:true,sort:'price-asc'});
 assert.deepEqual(filtered.map(p=>p.id),['c','a']);
 assert.deepEqual(products.map(p=>p.id),['a','b','c']);
 assert.deepEqual(selectCatalogProducts(products,{search:'',category:'',availableOnly:false,sort:'price-desc'})
  .map(p=>p.id),['a','c','b']);
 assert.equal(selectCatalogProducts(products,{search:'robe',category:'',availableOnly:true,sort:'featured'}).length,0);
});
test('P1/P2 anciennes images non validées refusées ; photos internes et HTTPS autorisées',()=>{
 assert.equal(publicProductImageUrl('javascript:alert(1)'),'');
 assert.equal(publicProductImageUrl('//attacker.test/p.png'),'');
 assert.equal(publicProductImageUrl('https://user:pass@cdn.test/a.jpg'),'');
 assert.equal(publicProductImageUrl('data:image/svg+xml;base64,bad'),'');
 assert.equal(publicProductImageUrl('/api/media/products/11111111-1111-4111-8111-111111111111'),products[0].imageUrl);
 assert.equal(publicProductImageUrl('https://cdn.test/img.jpg'),'https://cdn.test/img.jpg');
 const state=initialState(false);
 state.products=[
  {id:'p',sku:'PRIVATE-COST',name:'Produit',category:'Mode',variant:'',price:22000,cost:9999,
   stock:3,threshold:1,color:'#dddddd',active:true,imageUrl:'javascript:alert(1)'},
  {id:'q',sku:'PRIVATE-2',name:'Image',category:'Mode',variant:'',price:20000,cost:8888,
   stock:1,threshold:1,color:'#eeeeee',active:true,imageUrl:products[0].imageUrl}
 ];
 const preview=isolatedStorefrontPreview(state);
 assert.equal(preview.products[0].imageUrl,'');
 assert.equal(preview.products[1].imageUrl,products[0].imageUrl);
 assert.equal(publicProductDetail(state,'p')?.product.imageUrl,'');
 const text=JSON.stringify(preview);
 assert.equal(text.includes('PRIVATE-COST'),false);
 assert.equal(text.includes('9999'),false);
});
