import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialPageContent,pageContent,pagePhotoIds} from '../modules/shops/page-content';
import {homeContent,initialHomeContent} from '../modules/shops/home-content';
import {pageImageSource} from '../modules/shops/page-image';
import {readPageHistory,type PageRevision} from '../modules/shops/page-history';
const photo=randomUUID(),url='/api/media/products/'+photo;
const image=()=>({id:randomUUID(),type:'image' as const,title:'Notre équipe',imageUrl:url,alt:'Notre équipe prépare les commandes',caption:'Les coulisses',layout:'wide' as const,fit:'contain' as const});
test('page image sections preserve captions, formats and required accessible descriptions',()=>{
 const page=initialPageContent();page.sections=[image()];assert.deepEqual(pageContent.parse(page).sections,page.sections);
 for(const patch of [{alt:''},{layout:'free'},{fit:'stretch'},{caption:'x'.repeat(501)},{imageUrl:'http://example.com/photo.png'},{html:'unsafe'}])assert.equal(pageContent.safeParse({...page,sections:[{...image(),...patch}]}).success,false);
});
test('page image links accept owned-library syntax and safe HTTPS, excluding execution and credentials',()=>{
 const page=initialPageContent();
 for(const imageUrl of [url,'https://cdn.example.com/photo.webp?q=2'])assert.equal(pageContent.safeParse({...page,sections:[{...image(),imageUrl}]}).success,true);
 for(const imageUrl of ['javascript:alert(1)','data:image/png;base64,x','/api/media/products/no-id','https://user:password@example.com/a','https://example.com/with space.png','https://example.com/\\photo'])assert.equal(pageContent.safeParse({...page,sections:[{...image(),imageUrl}]}).success,false);
});
test('page references deduplicate internal photos and scope public URLs to the exact page',()=>{
 const page=initialPageContent();page.sections=[image(),image(),{...image(),imageUrl:'https://cdn.example.com/a.png'}];assert.deepEqual(pagePhotoIds(page),[photo]);
 assert.equal(pageImageSource(url,'studio','a-propos'),'/api/v1/public/vitrines/studio/pages/a-propos/images/'+photo);assert.equal(pageImageSource(url,'studio','a-propos',true),url);assert.equal(pageImageSource('https://cdn.example.com/a.png','studio','a-propos'),'https://cdn.example.com/a.png');
});
test('images survive page history validation and the existing homepage union has no duplicate image type',()=>{
 const page=initialPageContent();page.sections=[image()];const revision:PageRevision={id:randomUUID(),version:1,createdAt:new Date().toISOString(),action:'save',content:page};assert.deepEqual(readPageHistory([revision])[0].content.sections,page.sections);
 const home=initialHomeContent();home.fr.sections=[image()];assert.equal(homeContent.safeParse(home).success,true);
});
