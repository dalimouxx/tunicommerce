import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceSchema,readPresentation,defaultPresentation,accents,themes} from '../modules/appearance/validation';
import {appearanceThemeDetails,appearanceAccentText} from '../modules/appearance/theme-catalog';

const valid={
 theme:'prestige',accent:'#244A77',
 eyebrow:'SÉLECTION EXCLUSIVE',tagline:'Livraison rapide partout en Tunisie',
 description:'Vêtements pour tous',
 logoUrl:'https://images.example.test/logo.png',
 bannerUrl:'https://images.example.test/banner.webp'
};

test('Existing and new supported themes keep curated accent colors and reject injected styles',()=>{
 assert.equal(themes.length,8);
 assert.equal(accents.length,10);
 assert.deepEqual(themes.slice(0,4),['classic','editorial','prestige','pop']);
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

test('New legacy presets survive persisted validation and all curated CTA colors keep readable text',()=>{
 for(const theme of ['pulse','sorbet','chrome','groove'] as const){
  const preset=appearanceThemeDetails[theme],accent=preset.accent!;
  const input=appearanceSchema.parse({...valid,theme,accent});
  const stored={theme,accent,eyebrow:input.eyebrow,tagline:input.tagline};
  assert.equal(readPresentation({appearance:stored}).theme,theme);
  assert.equal(readPresentation({appearance:stored}).accent,accent);
  assert.equal(preset.animated,true);
 }
 const luminance=(color:string)=>{const rgb=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 for(const color of accents){const a=luminance(color),b=luminance(appearanceAccentText(color));assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,color);}
});

test('Existing shops without presentation preserve the classic default',()=>{
 assert.deepEqual(readPresentation({shop:{name:'Boutique héritée'}}),defaultPresentation);
 assert.deepEqual(readPresentation({appearance:{theme:'bogus',accent:'#fff'}}),defaultPresentation);
 assert.deepEqual(readPresentation({appearance:{theme:valid.theme,accent:valid.accent,eyebrow:valid.eyebrow,tagline:valid.tagline}}),{
  theme:'prestige',accent:'#244A77',
  eyebrow:'SÉLECTION EXCLUSIVE',tagline:'Livraison rapide partout en Tunisie'
 });
});
