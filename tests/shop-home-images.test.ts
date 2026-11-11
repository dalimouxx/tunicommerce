import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {homeContent,homePhotoIds,initialHomeContent} from '../modules/shops/home-content';
import {homeImageSection,isHomeImageUrl,homeImageSource} from '../modules/shops/home-image';
import {parseHomeRecovery} from '../modules/shops/home-editor-state';
const image=()=>({id:randomUUID(),type:'image' as const,title:'Nouvelle collection',imageUrl:'https://cdn.example.com/collection.webp',alt:'La collection présentée en boutique',caption:'Édition de saison',layout:'wide' as const,fit:'cover' as const});
test('homepage image sections accept external HTTPS and exact owned-library reference shapes',()=>{
 assert.ok(homeImageSection.safeParse(image()).success);assert.ok(isHomeImageUrl('/api/media/products/'+randomUUID()));
 const home=initialHomeContent();home.fr.sections=[image()];assert.ok(homeContent.safeParse(home).success);
});
test('image sources refuse executable schemes, credentials, relative and malformed internal paths',()=>{
 for(const url of ['https:/cdn.example.com/a.png','javascript:alert(1)','data:image/png;base64,abc','http://cdn.example.com/x.png','//cdn.example.com/x.png','/admin','https://user:password@cdn.example.com/x.png','/api/media/products/not-a-uuid','https://cdn.example.com/a\\b.png'])assert.equal(isHomeImageUrl(url),false,url);
});
test('images require meaningful alternate text and bounded plain captions and layout values',()=>{
 assert.equal(homeImageSection.safeParse({...image(),alt:'  '}).success,false);assert.equal(homeImageSection.safeParse({...image(),caption:'x'.repeat(501)}).success,false);assert.equal(homeImageSection.safeParse({...image(),fit:'url(javascript:evil)'}).success,false);
 assert.ok(homeImageSection.safeParse({...image(),layout:'portrait',fit:'contain',caption:'<script>Texte affiché tel quel</script>'}).success);
});
test('photo references are deduplicated across both languages and exclude external images',()=>{
 const home=initialHomeContent(),id=randomUUID();home.fr.sections=[{...image(),imageUrl:'/api/media/products/'+id},image()];home.ar.sections=[{...image(),imageUrl:'/api/media/products/'+id}];assert.deepEqual(homePhotoIds(home),[id]);
});
test('published internal photos use a shop-scoped route while private previews retain owner access',()=>{
 const id=randomUUID(),url='/api/media/products/'+id;assert.equal(homeImageSource(url,'studio'),'/api/v1/public/vitrines/studio/images/'+id);assert.equal(homeImageSource(url,'studio',true),url);assert.equal(homeImageSource('https://cdn.example.com/a.jpg','studio'),'https://cdn.example.com/a.jpg');
});
test('unfinished image URL and alternate text survive draft recovery without becoming publishable',()=>{
 const base=initialHomeContent(),content=initialHomeContent();content.fr.sections=[{...image(),imageUrl:'https://',alt:''}];assert.equal(homeContent.safeParse(content).success,false);
 const recovered=parseHomeRecovery(JSON.stringify({format:1,savedAt:Date.now(),version:0,base,content}));assert.ok(recovered);assert.deepEqual(recovered.content,content);
});

