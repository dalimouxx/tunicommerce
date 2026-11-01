import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceSchema,readPresentation,defaultPresentation,accents,themes} from '../modules/appearance/validation';

const valid={
 theme:'prestige',accent:'#244A77',
 eyebrow:'SÉLECTION EXCLUSIVE',tagline:'Livraison rapide partout en Tunisie',
 description:'Vêtements pour tous',
 logoUrl:'https://images.example.test/logo.png',
 bannerUrl:'https://images.example.test/banner.webp'
};

test('Only four supported themes and curated accessible accent colors are permitted',()=>{
 assert.equal(themes.length,4);
 assert.equal(accents.length,6);
 assert.deepEqual(appearanceSchema.parse(valid),valid);
 for(const invalid of [
  {...valid,theme:'external'},
  {...valid,accent:'red; background:url(javascript:alert(1))'},
  {...valid,accent:'#FFFFFF'},
  {...valid,logoUrl:'javascript:alert(1)'},
  {...valid,logoUrl:'http://images.example.test/logo.png'},
  {...valid,bannerUrl:'https://admin:password@images.example.test/photo.png'},
  {...valid,shopId:'another-shop'},
  {...valid,role:'ADMIN'},
  {...valid,description:'x'.repeat(1001)}
 ])assert.throws(()=>appearanceSchema.parse(invalid));
});

test('Existing shops without presentation preserve the classic default',()=>{
 assert.deepEqual(readPresentation({shop:{name:'Boutique héritée'}}),defaultPresentation);
 assert.deepEqual(readPresentation({appearance:{theme:'bogus',accent:'#fff'}}),defaultPresentation);
 assert.deepEqual(readPresentation({appearance:appearanceSchema.parse(valid)}),{
  theme:'prestige',accent:'#244A77',
  eyebrow:'SÉLECTION EXCLUSIVE',tagline:'Livraison rapide partout en Tunisie'
 });
});
