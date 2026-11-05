import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {isolatedStorefrontPreview} from '../modules/shops/storefront-preview';
import {storefrontPalette,storefrontThemeInput} from '../modules/shops/storefront-themes';

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

test('seven premium themes preserve existing codes and expose safe fixed palettes',()=>{
 const codes=['OASIS','SABLE','MINUIT','NOVA','ATELIER','PRESTIGE','POP'];
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
