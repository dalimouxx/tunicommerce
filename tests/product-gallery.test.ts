import test from 'node:test';
import assert from 'node:assert/strict';
import {PRODUCT_PHOTO_LIMIT,productGallery,productPhotoUrls,productLibraryPhotoIds,productUsesPhoto,arrangeGallery,addImportedPhotos,importedPhotosMessage} from '../modules/product-media/gallery';
import {applyAction} from '../modules/commerce/service';
import {initialState} from '../modules/commerce/seed';
import {publicCatalog} from '../modules/platform/public';
import {productJsonLd} from '../modules/seo/structured-data';

const id=(n:number)=>'123e4567-e89b-42d3-a456-4266141740'+String(n).padStart(2,'0');
const photo=(n:number)=>'/api/media/products/'+id(n);

test('A product holds at most 8 photos: one main plus 7 in the gallery, without duplicates',()=>{
 assert.equal(PRODUCT_PHOTO_LIMIT,8);
 assert.equal(productGallery.safeParse(Array.from({length:7},(_,i)=>photo(i))).success,true);
 assert.equal(productGallery.safeParse(Array.from({length:8},(_,i)=>photo(i))).success,false);
 assert.equal(productGallery.safeParse([photo(1),photo(1)]).success,false);
 assert.equal(productGallery.safeParse(['javascript:alert(1)']).success,false);
 assert.equal(productGallery.safeParse(['http://insecure.example/a.png']).success,false);
 assert.equal(productGallery.safeParse(['https://cdn.example/a.png',photo(2)]).success,true);
});
test('Photo lists start with the main photo, skip empties and duplicates, and never exceed 8',()=>{
 assert.deepEqual(productPhotoUrls({imageUrl:photo(1),gallery:[photo(2),photo(1),'',photo(3)]}),[photo(1),photo(2),photo(3)]);
 assert.deepEqual(productPhotoUrls({imageUrl:'',gallery:[photo(2)]}),[photo(2)]);
 assert.equal(productPhotoUrls({imageUrl:photo(0),gallery:Array.from({length:12},(_,i)=>photo(i+1))}).length,8);
 assert.deepEqual(productLibraryPhotoIds({imageUrl:'https://cdn.example/a.png',gallery:[photo(4),photo(4)]}),[id(4)]);
 assert.equal(productUsesPhoto({imageUrl:photo(1),gallery:[photo(5)]},photo(5)),true);
 assert.equal(productUsesPhoto({imageUrl:photo(1)},photo(5)),false);
});
test('Merchant arrangement: make main, move, remove, add; the limit is enforced',()=>{
 const start=[photo(1),photo(2),photo(3)];
 assert.deepEqual(arrangeGallery(start,{type:'main',index:2}),[photo(3),photo(1),photo(2)]);
 assert.deepEqual(arrangeGallery(start,{type:'move',index:1,by:1}),[photo(1),photo(3),photo(2)]);
 assert.deepEqual(arrangeGallery(start,{type:'move',index:0,by:-1}),start);
 assert.deepEqual(arrangeGallery(start,{type:'remove',index:0}),[photo(2),photo(3)]);
 assert.deepEqual(arrangeGallery(start,{type:'add',url:photo(2)}),start);
 assert.deepEqual(arrangeGallery(start,{type:'add',url:photo(4)}),[...start,photo(4)]);
 const full=Array.from({length:8},(_,i)=>photo(i));
 assert.deepEqual(arrangeGallery(full,{type:'add',url:photo(9)}),full);
});
test('Saving a product keeps its gallery; omitting it leaves the gallery untouched',()=>{
 const base=initialState(false);
 const product={name:'Sac',sku:'SAC-1',category:'Mode',variant:'',price:1000,cost:0,stock:1,threshold:0,color:'#aabbcc'};
 let state=applyAction(base,'product',{...product,imageUrl:photo(1),gallery:[photo(2),photo(3)]});
 const saved=state.products.find(p=>p.sku==='SAC-1')!;
 assert.deepEqual(saved.gallery,[photo(2),photo(3)]);
 state=applyAction(state,'product',{...product,id:saved.id,name:'Sac cuir'});
 assert.deepEqual(state.products.find(p=>p.id===saved.id)!.gallery,[photo(2),photo(3)]);
 assert.throws(()=>applyAction(state,'product',{...product,id:saved.id,gallery:Array.from({length:8},(_,i)=>photo(i))}));
 const catalog=publicCatalog(state).products.find(p=>p.id===saved.id)!;
 assert.deepEqual(catalog.images,[photo(1),photo(2),photo(3)]);
});
test('Structured data lists every product photo as absolute URLs',()=>{
 const data=productJsonLd({name:'Sac',description:'',imageUrl:photo(1),images:[photo(1),photo(2)],url:'https://shop.example/p',price:1000,available:true,storeName:'S',origin:'https://shop.example'}) as {image?:unknown};
 assert.deepEqual(data.image,['https://shop.example'+photo(1),'https://shop.example'+photo(2)]);
});
test('Imported photos join the product in import order, without duplicates, up to 8',()=>{
 const start=[photo(1),photo(2)];
 assert.deepEqual(addImportedPhotos(start,[photo(3),photo(2),photo(4)]),{next:[photo(1),photo(2),photo(3),photo(4)],added:2,dropped:0});
 const seven=Array.from({length:7},(_,i)=>photo(i));
 assert.deepEqual(addImportedPhotos(seven,[photo(20),photo(21),photo(22)]),{next:[...seven,photo(20)],added:1,dropped:2});
 assert.equal(importedPhotosMessage({added:3,dropped:0}),'3 photos ajoutées au produit.');
 assert.equal(importedPhotosMessage({added:1,dropped:2}),'1 photo ajoutée au produit. 2 photos non ajoutées : 8 photos maximum par produit (elles restent dans la médiathèque).');
 assert.equal(importedPhotosMessage({added:0,dropped:1}),'1 photo non ajoutée : 8 photos maximum par produit (elle reste dans la médiathèque).');
 assert.equal(importedPhotosMessage({added:0,dropped:0}),'');
});
