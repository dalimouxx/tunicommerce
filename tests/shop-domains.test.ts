import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeDomain,automaticStoreSlug,domainMutation,proofMatches,reservedDomain} from '../modules/shops/domains-validation';
import {checkDomainProof} from '../modules/shops/domains-dns';import {domainRoute} from '../modules/shops/domain-path-policy';
test('domain normalization rejects URLs, IPs, local names, malformed labels and authority tricks',()=>{
 assert.equal(normalizeDomain(' Boutique.Marque.tn. '),'boutique.marque.tn');assert.equal(normalizeDomain('éclat.marque.tn'),'xn--clat-9oa.marque.tn');
 for(const value of ['https://marque.tn','a@marque.tn','marque.tn:443','127.0.0.1','[::1]','localhost','a.local','a.test','a..tn','-a.tn','a-.tn','a.tn/path','a.tn%2f','a'.repeat(64)+'.tn'])assert.equal(normalizeDomain(value),null,value);
 assert.equal(domainMutation.safeParse({action:'add',hostname:'marque.tn',shopId:'forged'}).success,false);
});
test('automatic subdomains and reserved platform hosts never become custom claims',()=>{
 const env={APP_URL:'https://tunicom.tn',STOREFRONT_ROOT_DOMAIN:'shops.tunicom.tn'};
 assert.equal(automaticStoreSlug('studio.shops.tunicom.tn',env),'studio');for(const value of ['www.shops.tunicom.tn','a.b.shops.tunicom.tn','shops.tunicom.tn','studio.shops.tunicom.tn.evil.tn'])assert.equal(automaticStoreSlug(value,env),null);
 assert.equal(reservedDomain('tunicom.tn',env),true);assert.equal(reservedDomain('studio.shops.tunicom.tn',env),true);assert.equal(reservedDomain('mamarque.tn',env),false);
});
test('TXT chunks must match the exact per-claim challenge and DNS errors remain explicit',async()=>{
 assert.equal(proofMatches([['tunicom=','abc']],'abc'),true);assert.equal(proofMatches([['unrelated=abc']],'abc'),false);
 await checkDomainProof('marque.tn','abc',async name=>{assert.equal(name,'_tunicom-verification.marque.tn');return [['tunicom=abc']];});
 await assert.rejects(checkDomainProof('marque.tn','abc',async()=>[['tunicom=other']]),/ne correspond pas/);
 await assert.rejects(checkDomainProof('marque.tn','abc',async()=>{throw {code:'ENOTFOUND'};}),/introuvable/);
 await assert.rejects(checkDomainProof('marque.tn','abc',async()=>{throw {code:'ETIMEOUT'};}),/indisponible/);
});
test('custom host paths expose only their own public storefront and its checkout',()=>{
 assert.deepEqual(domainRoute('/','studio','GET'),{kind:'rewrite',path:'/vitrines/studio'});
 assert.deepEqual(domainRoute('/produit/p1','studio','GET'),{kind:'rewrite',path:'/vitrines/studio/produit/p1'});
 assert.deepEqual(domainRoute('/vitrines/studio','studio','GET'),{kind:'redirect',path:'/'});
 assert.equal(domainRoute('/api/v1/public/vitrines/studio/checkout','studio','POST').kind,'pass');
 for(const path of ['/admin','/connexion','/mes-boutiques','/api/admin/plans','/api/commerce','/vitrines/foreign','/api/v1/public/vitrines/foreign/checkout','/pages/../admin','/_next/image'])assert.equal(domainRoute(path,'studio','POST').kind,'deny',path);
 assert.equal(domainRoute('/produit/p1','studio','POST').kind,'deny');assert.equal(domainRoute('/_next/static/a.js','studio','GET').kind,'pass');
});
