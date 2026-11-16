import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import PromoPrice from '../components/promo-price';
import {countdownText} from '../components/promo-countdown';

const promotion={regularPrice:89000,endsAt:'2026-11-20T22:59:00.000Z',percent:22};
test('a promotion shows the regular price struck through, the percentage and its end date',()=>{
 const html=renderToStaticMarkup(createElement(PromoPrice,{price:69000,promotion,lang:'fr'}));
 assert.match(html,/<del[^>]*>89,000 TND<\/del>/);
 assert.ok(html.includes('69,000 TND'));
 assert.ok(html.includes('−22 %'));
 assert.ok(html.includes('Jusqu’au 20 nov.'));
 assert.ok(html.includes('data-part="promo-countdown"'));
});
test('without promotion only the price is rendered',()=>{
 const html=renderToStaticMarkup(createElement(PromoPrice,{price:89000,promotion:null,lang:'fr'}));
 assert.ok(html.includes('89,000 TND'));assert.ok(!html.includes('<del'));assert.ok(!html.includes('%'));
});
test('arabic labels are used in RTL storefronts',()=>{
 const html=renderToStaticMarkup(createElement(PromoPrice,{price:69000,promotion,lang:'ar'}));
 assert.ok(html.includes('<del'));assert.ok(html.includes('22'));assert.ok(!html.includes('Jusqu’au'));
});
test('countdown text counts real remaining time and says when it is over',()=>{
 const now=new Date('2026-11-18T20:58:00.000Z');
 assert.equal(countdownText(promotion.endsAt,now,'fr'),'Se termine dans 2 j 02 h 01 min');
 assert.equal(countdownText(promotion.endsAt,new Date('2026-11-20T22:00:30.000Z'),'fr'),'Se termine dans 58 min 30 s');
 assert.equal(countdownText(promotion.endsAt,new Date('2026-11-20T23:00:00.000Z'),'fr'),'Promotion terminée');
 assert.ok(countdownText(promotion.endsAt,now,'ar').includes('2'));
});
