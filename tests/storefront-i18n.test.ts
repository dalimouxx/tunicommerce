import test from 'node:test';
import assert from 'node:assert/strict';
import {governors} from '../modules/commerce/types';
import {
 formatStorefrontMoney,governorateLabel,resolveStorefrontLang,storefrontDictionary,
 storefrontDir,storefrontLangHref
} from '../modules/shops/storefront-i18n';

test('language follows the link, then the buyer choice, then the merchant default',()=>{
 assert.equal(resolveStorefrontLang('ar','fr','fr'),'ar');
 assert.equal(resolveStorefrontLang(undefined,'ar','fr'),'ar');
 assert.equal(resolveStorefrontLang(undefined,undefined,'ar'),'ar');
 assert.equal(resolveStorefrontLang('en','<script>',undefined),'fr');
 assert.equal(storefrontDir('ar'),'rtl');
 assert.equal(storefrontDir('fr'),'ltr');
 assert.equal(storefrontLangHref('/vitrines/x','ar'),'/vitrines/x?lang=ar');
 assert.equal(storefrontLangHref('/vitrines/x?produit=1','fr'),'/vitrines/x?produit=1&lang=fr');
});

test('Arabic dictionary covers every French key with real Arabic text',()=>{
 const fr=storefrontDictionary('fr'),ar=storefrontDictionary('ar');
 assert.deepEqual(Object.keys(ar).sort(),Object.keys(fr).sort());
 for(const [key,value] of Object.entries(ar)){
  const text=typeof value==='function'?(value as (...a:any[])=>string)('X',2):value;
  assert.equal(typeof text,'string',key);
  if(!['langName','switchTo','switchLabel'].includes(key))
   assert.match(text,/[؀-ۿ]/,'texte arabe manquant pour '+key);
 }
});

test('all 24 governorates have an Arabic label and amounts keep Western digits',()=>{
 for(const name of governors)assert.match(governorateLabel(name,'ar'),/^[؀-ۿ ]+$/,name);
 assert.equal(governorateLabel('Sfax','fr'),'Sfax');
 assert.equal(formatStorefrontMoney(39900,'ar'),'39,900 د.ت');
 assert.equal(formatStorefrontMoney(39900,'fr'),'39,900 TND');
});
