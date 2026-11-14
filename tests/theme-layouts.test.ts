import test from 'node:test';
import assert from 'node:assert/strict';
import {storefrontThemeCodes,animatedStorefrontTheme} from '../modules/shops/storefront-themes';
import {themes} from '../modules/appearance/validation';
import {storefrontLayout,appearanceLayout,isNewLayoutTheme} from '../modules/shops/theme-layouts';

test('every storefront code has a closed layout',()=>{
 for(const code of storefrontThemeCodes){
  const layout=storefrontLayout(code);
  assert.ok(['split','bento','fullbleed','arch','dunes','marquee'].includes(layout.hero),code);
 }
 assert.deepEqual(storefrontLayout('BENTO'),{hero:'bento',cards:'tile',motif:'none'});
 assert.deepEqual(storefrontLayout('url(x)'),storefrontLayout('OASIS'));
});
test('appearance themes map to layouts and fall back to classic',()=>{
 for(const theme of themes)assert.ok(appearanceLayout(theme));
 assert.deepEqual(appearanceLayout('souk'),{hero:'marquee',cards:'flash',motif:'stripes'});
 assert.deepEqual(appearanceLayout('nope'),appearanceLayout('classic'));
 assert.equal(isNewLayoutTheme('MEDINA'),true);
 assert.equal(isNewLayoutTheme('medina'),true);
 assert.equal(isNewLayoutTheme('OASIS'),false);
});
test('all themes are animated',()=>{
 for(const code of storefrontThemeCodes)assert.equal(animatedStorefrontTheme(code),true,code);
 assert.equal(animatedStorefrontTheme('NOPE'),false);
});
