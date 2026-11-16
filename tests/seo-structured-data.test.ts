import test from 'node:test';
import assert from 'node:assert/strict';
import {jsonLdScript,productJsonLd,storeJsonLd} from '../modules/seo/structured-data';
import {absoluteUrl,storefrontAlternates} from '../modules/seo/urls';

const origin='https://tunicom.example';
const product={name:'Casque </script><script>alert(1)</script>',description:'Son & basses',imageUrl:'/api/media/products/0b0c6a6e-1111-4222-8333-944445555666',
 url:origin+'/vitrines/demo/produit/p1',price:89000,available:true,storeName:'Demo',origin};

test('JSON-LD cannot close the surrounding script tag',()=>{
 const script=jsonLdScript(productJsonLd(product));
 assert.ok(!script.includes('</script'));
 assert.ok(!script.includes('<'));
 assert.ok(script.includes('\\u003c/script'));
 assert.ok(!/[\u2028\u2029]/.test(jsonLdScript({text:'a\u2028b\u2029c'})));
 assert.equal(JSON.parse(script).name,product.name);
});
test('product offer uses TND with three decimals and real availability, never ratings',()=>{
 const data=productJsonLd(product) as Record<string,any>;
 assert.equal(data['@type'],'Product');
 assert.equal(data.offers.price,'89.000');
 assert.equal(data.offers.priceCurrency,'TND');
 assert.equal(data.offers.availability,'https://schema.org/InStock');
 assert.equal((productJsonLd({...product,available:false}) as any).offers.availability,'https://schema.org/OutOfStock');
 assert.equal(data.image,origin+'/api/media/products/0b0c6a6e-1111-4222-8333-944445555666');
 assert.ok(!('aggregateRating' in data)&&!('review' in data));
 assert.equal((productJsonLd({...product,imageUrl:''}) as any).image,undefined);
});
test('store data and absolute URLs',()=>{
 const store=storeJsonLd({name:'Demo',description:'',url:origin+'/vitrines/demo',logoUrl:'https://cdn.example/logo.png',origin}) as any;
 assert.equal(store['@type'],'Store');assert.equal(store.logo,'https://cdn.example/logo.png');
 assert.equal(absoluteUrl(origin,'/x'),origin+'/x');
 assert.equal(absoluteUrl(origin,'https://cdn.example/a.png'),'https://cdn.example/a.png');
 assert.equal(absoluteUrl(origin,'javascript:alert(1)'),'');
 assert.equal(absoluteUrl(origin,''),'');
});
test('alternates expose canonical and both languages',()=>{
 assert.deepEqual(storefrontAlternates(origin,'/vitrines/demo'),{canonical:origin+'/vitrines/demo',languages:{fr:origin+'/vitrines/demo',ar:origin+'/vitrines/demo?lang=ar'}});
});
test('canonical path follows the custom domain when one is active',async()=>{
 const {canonicalPath}=await import('../modules/seo/urls');
 assert.equal(canonicalPath('https://marque.tn','https://tunicom.example','/vitrines/demo/produit/p1','/produit/p1'),'/produit/p1');
 assert.equal(canonicalPath('https://tunicom.example','https://tunicom.example','/vitrines/demo/produit/p1','/produit/p1'),'/vitrines/demo/produit/p1');
 assert.equal(canonicalPath('https://tunicom.example/','https://tunicom.example','/vitrines/demo','/'),'/vitrines/demo');
});
test('a promotional offer carries its real end date for Google',()=>{
 const data=productJsonLd({...product,price:69000,priceValidUntil:'2026-11-20T22:59:00.000Z'}) as any;
 assert.equal(data.offers.price,'69.000');assert.equal(data.offers.priceValidUntil,'2026-11-20');
 assert.equal((productJsonLd(product) as any).offers.priceValidUntil,undefined);
});
