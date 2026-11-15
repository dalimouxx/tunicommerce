import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ProductReviews from '../components/product-reviews';
import RatingStars from '../components/rating-stars';

const items=[{id:'r1',rating:5,comment:'<b>Top</b> produit',authorName:'Amira B.',merchantReply:'Merci !',repliedAt:new Date('2026-11-15T10:00:00Z'),createdAt:new Date('2026-11-14T10:00:00Z')}];
test('product reviews show the average, verified badge, escaped comment and merchant reply',()=>{
 const html=renderToStaticMarkup(createElement(ProductReviews,{summary:{count:1,average:5},items,lang:'fr'}));
 assert.ok(html.includes('Achat vérifié'));
 assert.ok(html.includes('&lt;b&gt;Top&lt;/b&gt; produit'));
 assert.ok(html.includes('Amira B.'));
 assert.ok(html.includes('Réponse de la boutique'));
 assert.ok(html.includes('5,0'));
 assert.ok(html.includes('aria-label="Note : 5 sur 5"'));
});
test('without reviews the section explains how reviews are collected',()=>{
 const html=renderToStaticMarkup(createElement(ProductReviews,{summary:{count:0,average:0},items:[],lang:'fr'}));
 assert.ok(html.includes('Aucun avis pour le moment'));
 assert.ok(html.includes('livr'));
 const ar=renderToStaticMarkup(createElement(ProductReviews,{summary:{count:1,average:5},items,lang:'ar'}));
 assert.ok(ar.includes('شراء مؤكد'));
});
test('card stars round to half steps and stay accessible',()=>{
 const html=renderToStaticMarkup(createElement(RatingStars,{average:4.6,count:12,lang:'fr'}));
 assert.ok(html.includes('4,6'));assert.ok(html.includes('(12)'));assert.ok(html.includes('aria-label="Note moyenne 4,6 sur 5, 12 avis"'));
 assert.equal(renderToStaticMarkup(createElement(RatingStars,{average:0,count:0,lang:'fr'})),'');
});
test('pages wire reviews into tracking, product page, catalog cards, merchant and admin spaces',()=>{
 const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 assert.ok(read('app/vitrines/[slug]/suivi/[token]/page.tsx').includes('<ReviewForm'));
 const product=read('app/vitrines/[slug]/produit/[productId]/page.tsx');
 assert.ok(product.includes('<ProductReviews')&&product.includes('reviewJsonLd('));
 assert.ok(read('app/vitrines/[slug]/catalog-browser.tsx').includes('<RatingStars'));
 assert.ok(read('app/mes-boutiques/[shopId]/merchant-shop-workspace.tsx').includes('<ShopReviews'));
 assert.ok(read('app/admin/layout.tsx').includes('/admin/avis'));
});
