import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const storefronts=['app/vitrines/[slug]/page.tsx','app/themes/[theme]/page.tsx','app/mes-boutiques/[shopId]/apercu/page.tsx'];

test('every page that renders a storefront applies the full theme, not only its colours',()=>{
 for(const path of storefronts){
  const page=source(path)+(path.startsWith('app/vitrines/')?source('app/vitrines/[slug]/catalog-browser.tsx'):'');
  for(const marker of ['storefrontLayout(','themeClass(','<ThemeMotif','<ThemeHeroExtras','motion.root','data-motion-root','data-part="hero"','data-part="product-card"','data-part="header"'])
   assert.ok(page.includes(marker),path+' is missing '+marker);
 }
});
test('the independent-shop editor previews the selected theme layout',()=>{
 const editor=source('app/personnalisation/store-brand-editor.tsx');
 for(const marker of ['appearanceLayout(','themeClass(','<ThemeMotif','data-hero='])assert.ok(editor.includes(marker),marker);
 assert.ok(!editor.includes('Huit thèmes'),'stale theme count');
});
test('the theme gallery shows each layout and links to its live demo',()=>{
 const gallery=source('app/mes-boutiques/[shopId]/shop-storefront-themes.tsx');
 for(const marker of ['storefrontLayout(','data-hero=','/themes/','themeHighlights('])assert.ok(gallery.includes(marker),marker);
});
test('the product page applies the theme layout and every new theme styles the product detail',()=>{
 const page=source('app/vitrines/[slug]/produit/[productId]/page.tsx');
 for(const marker of ['storefrontLayout(','themeClass(','<ThemeMotif','<StorefrontReveal','data-hero=','data-part="header"','data-part="announcement"','data-part="product-detail"','data-part="product-detail-media"','data-part="product-detail-copy"','data-part="footer"','<StorefrontMotionToggle'])
  assert.ok(page.includes(marker),'product page is missing '+marker);
 for(const name of ['medina','sahara','bento','souk','aurora','magazine'])
  assert.match(source('components/storefront-themes/'+name+'.module.css'),/\[data-part="product-detail-media"\]/,name);
});
