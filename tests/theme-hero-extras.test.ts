import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ThemeHeroExtras from '../components/theme-hero-extras';
import ThemeMotif from '../components/theme-motif';
import {storefrontLayout} from '../modules/shops/theme-layouts';
import {storefrontDictionary} from '../modules/shops/storefront-i18n';

const product=(index:number,available=true)=>({id:'p'+index,name:'Produit '+index,price:1000*(index+1),available});
const render=(code:string,products:ReturnType<typeof product>[],categories:string[]=[])=>
 renderToStaticMarkup(createElement(ThemeHeroExtras,{layout:storefrontLayout(code),products,categories,lang:'fr',shopPath:'/vitrines/demo'}));
const count=(html:string,part:string)=>html.split('data-part="'+part+'"').length-1;

test('bento shows only tiles backed by real data',()=>{
 const empty=render('BENTO',[]);
 assert.equal(count(empty,'bento-tile'),1);
 assert.ok(empty.includes('Paiement à la livraison'));
 const full=render('BENTO',[product(0)],['Casques','Sacs']);
 assert.equal(count(full,'bento-tile'),3);
 assert.ok(full.includes('Casques')&&full.includes('Produit 0'));
});
test('souk strip lists at most six available products and nothing when none is available',()=>{
 assert.equal(render('SOUK',[product(0,false)]),'');
 const html=render('SOUK',Array.from({length:9},(_,index)=>product(index)));
 const names=new Set(html.match(/Produit \d/g));
 assert.equal(names.size,6);
 assert.ok(html.includes('aria-hidden="true"'));
});
test('other layouts render no extras',()=>{
 assert.equal(render('OASIS',[product(0)],['A']),'');
 assert.equal(render('MAGAZINE',[product(0)],['A']),'');
});
test('motifs are decorative and absent for plain themes',()=>{
 assert.equal(renderToStaticMarkup(createElement(ThemeMotif,{motif:'none'})),'');
 for(const motif of ['zellige','dunes','aurora','grain','stripes'] as const){
  const html=renderToStaticMarkup(createElement(ThemeMotif,{motif}));
  assert.match(html,/^<div[^>]*aria-hidden="true"/);
  assert.ok(html.includes('data-part="motif"'));
  assert.ok(!/https?:/.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g,'')));
 }
});
test('offer badge copy exists in both languages',()=>{
 assert.equal(storefrontDictionary('fr').offerBadge(2,'89,000 DT'),'2 pièces · 89,000 DT');
 assert.ok(storefrontDictionary('ar').offerBadge(2,'89').includes('2'));
});
