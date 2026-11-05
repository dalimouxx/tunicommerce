import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {isolatedStorefrontPreview} from '../modules/shops/storefront-preview';
import {storefrontPalette,storefrontThemeInput,previewStorefrontTheme,storefrontSectors,storefrontThemesForSector} from '../modules/shops/storefront-themes';

test('default theme remains safe for older shop records',()=>{
 const state=initialState(false);
 assert.equal(storefrontPalette(undefined).code,'OASIS');
 assert.equal(isolatedStorefrontPreview(state).theme.code,'OASIS');
 assert.equal(storefrontPalette('url(javascript:alert(1))').code,'OASIS');
});
test('theme mutation changes only visual state and never catalog or finance',()=>{
 const state=initialState(false);
 const before=JSON.stringify(state);
 const next=applyAction(state,'saveStorefrontTheme',{theme:'MINUIT'});
 assert.equal(next.shop.theme,'MINUIT');
 assert.equal(isolatedStorefrontPreview(next).theme.code,'MINUIT');
 assert.equal(state.shop.theme,undefined);
 assert.equal(state.products.length,next.products.length);
 assert.equal(state.orders.length,next.orders.length);
 assert.equal(before,JSON.stringify(state));
 assert.throws(()=>applyAction(next,'saveStorefrontTheme',{theme:'CUSTOM_CSS'}));
});
test('strict payload refuses arbitrary CSS and extra properties',()=>{
 const request={action:'saveStorefrontTheme',requestId:crypto.randomUUID(),payload:{theme:'SABLE'}};
 assert.equal(storefrontThemeInput.safeParse(request).success,true);
 assert.equal(storefrontThemeInput.safeParse({...request,payload:{...request.payload,css:'body{display:none}'}}).success,false);
});

test('ten premium themes preserve existing codes and expose safe fixed palettes',()=>{
 const codes=['OASIS','SABLE','MINUIT','NOVA','ATELIER','PRESTIGE','POP','ECLAT','URBAN','ZEN'];
 for(const code of codes){
  const theme=storefrontPalette(code);
  assert.equal(theme.code,code);
  assert.match(theme.accent,/^#[0-9a-f]{6}$/i);
  assert.match(theme.background,/^#[0-9a-f]{6}$/i);
  assert.match(theme.surface,/^#[0-9a-f]{6}$/i);
  assert.match(theme.accentText,/^#[0-9a-f]{6}$/i);
  const request={action:'saveStorefrontTheme',requestId:crypto.randomUUID(),payload:{theme:code}};
  assert.equal(storefrontThemeInput.safeParse(request).success,true);
  const persisted=applyAction(initialState(false),'saveStorefrontTheme',{theme:code});
  assert.equal(isolatedStorefrontPreview(persisted).theme.code,code);
 }
 assert.equal(new Set(codes.map(code=>storefrontPalette(code).accent)).size,codes.length);
 assert.equal(storefrontThemeInput.safeParse({action:'saveStorefrontTheme',requestId:crypto.randomUUID(),
  payload:{theme:'BACKGROUND:url(javascript:alert(1))'}}).success,false);
});

test('theme CTA button colors maintain WCAG AA contrast',()=>{
 const luminance=(color:string)=>{
  const normalized=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255)
   .map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return normalized[0]*.2126+normalized[1]*.7152+normalized[2]*.0722;
 };
 for(const code of ['OASIS','SABLE','MINUIT','NOVA','ATELIER','PRESTIGE','POP','ECLAT','URBAN','ZEN']){
  const palette=storefrontPalette(code);
  const a=luminance(palette.accent),b=luminance(palette.accentText);
  const contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert.ok(contrast>=4.5,code+' CTA contrast ratio '+contrast);
 }
});

test('private temporary theme preview never changes persisted storefront selection',()=>{
 const state=initialState(false);
 const before=JSON.stringify(state);
 const temporary=previewStorefrontTheme('OASIS','ZEN');
 assert.equal(temporary.theme.code,'ZEN');
 assert.equal(temporary.temporary,true);
 assert.equal(previewStorefrontTheme('OASIS','url(javascript:alert(1))').theme.code,'OASIS');
 assert.equal(previewStorefrontTheme('OASIS',['URBAN']).theme.code,'OASIS');
 assert.equal(previewStorefrontTheme('OASIS','OASIS').temporary,false);
 assert.equal(JSON.stringify(state),before);
 for(const code of ['ECLAT','URBAN','ZEN']){
  const selection=previewStorefrontTheme('OASIS',code);
  assert.equal(selection.theme.code,code);
  const updated=applyAction(state,'saveStorefrontTheme',{theme:code});
  assert.equal(updated.shop.theme,code);
  assert.equal(state.shop.theme,undefined);
 }
});

test('studio sector gallery provides safe curated choices without hiding saved themes',()=>{
 const all=storefrontThemesForSector('ALL');
 assert.equal(all.length,10);
 assert.equal(storefrontSectors.length,7);
 for(const item of storefrontSectors){
  const suggestions=storefrontThemesForSector(item.id);
  assert.ok(suggestions.length>0);
  assert.equal(new Set(suggestions).size,suggestions.length);
  assert.ok(suggestions.every(code=>all.includes(code)));
 }
 assert.ok(storefrontThemesForSector('FASHION').includes('URBAN'));
 assert.ok(storefrontThemesForSector('BEAUTY').includes('ECLAT'));
 assert.ok(storefrontThemesForSector('WELLNESS').includes('ZEN'));
 assert.equal(storefrontThemesForSector('url(javascript:alert(1))').length,10);
 assert.equal(storefrontThemesForSector({payload:'CUSTOM_CSS'}).length,10);
});
