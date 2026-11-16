import test from 'node:test';
import assert from 'node:assert/strict';
import {platformSitemapEntries,shopSitemapEntries,robotsBody,platformRobots,type SitemapShop} from '../modules/seo/sitemap';

const origin='https://tunicom.example';
const shop=(over:Partial<SitemapShop>={}):SitemapShop=>({kind:'vitrine',slug:'demo',public:true,demo:false,customHost:null,
 products:[{id:'p1',available:true},{id:'p2',available:false}],pages:['a-propos'],updatedAt:new Date('2026-11-01T00:00:00Z'),...over});
const urls=(entries:{url:string}[])=>entries.map(entry=>entry.url);

test('platform sitemap lists public pages, published shops, available products and pages',()=>{
 const list=urls(platformSitemapEntries(origin,[shop(),shop({kind:'boutique',slug:'ancienne',products:[]})]));
 for(const url of [origin+'/',origin+'/decouvrir',origin+'/boutiques',origin+'/themes/MEDINA',origin+'/vitrines/demo',origin+'/vitrines/demo/produit/p1',origin+'/vitrines/demo/pages/a-propos',origin+'/boutiques/ancienne',origin+'/boutiques/ancienne/pages/a-propos'])
  assert.ok(list.includes(url),url);
 assert.ok(!list.includes(origin+'/vitrines/demo/produit/p2'));
});
test('closed, demo and custom-domain shops stay out of the platform sitemap',()=>{
 const list=urls(platformSitemapEntries(origin,[shop({slug:'fermee',public:false}),shop({slug:'demo-cat',demo:true}),shop({slug:'perso',customHost:'marque.tn'})]));
 assert.ok(!list.some(url=>/fermee|demo-cat|perso/.test(url)));
});
test('a custom domain sitemap uses its own host and root paths',()=>{
 const list=urls(shopSitemapEntries('https://marque.tn',shop({customHost:'marque.tn'})));
 assert.deepEqual(list,['https://marque.tn/','https://marque.tn/produit/p1','https://marque.tn/pages/a-propos']);
 const legacy=urls(shopSitemapEntries('https://marque.tn',shop({kind:'boutique',customHost:'marque.tn',products:[{id:'x',available:true}]})));
 assert.deepEqual(legacy,['https://marque.tn/','https://marque.tn/pages/a-propos']);
 assert.deepEqual(shopSitemapEntries('https://marque.tn',shop({public:false})),[]);
});
test('robots allow storefronts, block private areas and point to the sitemap',()=>{
 const robots=platformRobots(origin);
 const rule=Array.isArray(robots.rules)?robots.rules[0]:robots.rules;
 for(const path of ['/admin','/api','/compte','/connexion','/mes-boutiques','/suivi'])assert.ok((rule.disallow as string[]).includes(path),path);
 assert.ok((rule.allow as string[]).includes('/vitrines'));
 assert.equal(robots.sitemap,origin+'/sitemap.xml');
 const body=robotsBody('https://marque.tn');
 assert.match(body,/User-agent: \*/);assert.match(body,/Disallow: \/api/);assert.match(body,/Sitemap: https:\/\/marque\.tn\/sitemap\.xml/);
});
test('demo catalogs are recognised so their pages are never indexed',async()=>{
 const {isDemoCatalog}=await import('../modules/seo/sitemap');
 assert.equal(isDemoCatalog({demo:true}),true);
 assert.equal(isDemoCatalog({demo:false}),false);
 assert.equal(isDemoCatalog(null),false);
 assert.equal(isDemoCatalog('demo'),false);
});
