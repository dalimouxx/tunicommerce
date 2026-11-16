import test from 'node:test';
import assert from 'node:assert/strict';
import {domainRoute} from '../modules/shops/domain-path-policy';

test('custom domains serve their own robots.txt and sitemap.xml',()=>{
 for(const [path,target] of [['/robots.txt','robots'],['/sitemap.xml','sitemap']]){
  assert.deepEqual(domainRoute(path,'ma-boutique','GET'),{kind:'rewrite',path:'/api/v1/public/seo/ma-boutique/'+target});
  assert.deepEqual(domainRoute(path,'ma-boutique','HEAD'),{kind:'rewrite',path:'/api/v1/public/seo/ma-boutique/'+target});
  assert.deepEqual(domainRoute(path,'ma-boutique','GET','ancienne'),{kind:'rewrite',path:'/api/v1/public/seo/ma-boutique/'+target});
  assert.equal(domainRoute(path,'ma-boutique','POST').kind,'deny');
 }
 assert.equal(domainRoute('/api/v1/public/seo/autre/sitemap','ma-boutique','GET').kind,'deny');
 assert.equal(domainRoute('/sitemap.xml.bak','ma-boutique','GET').kind,'deny');
});
test('custom domains accept a review posted from the private tracking page only',()=>{
 const token='0b0c6a6e-1111-4222-8333-944445555666',api='/api/v1/public/vitrines/ma-boutique/suivi/'+token;
 assert.equal(domainRoute(api+'/avis','ma-boutique','POST').kind,'pass');
 assert.equal(domainRoute(api+'/avis','ma-boutique','GET').kind,'deny');
 assert.equal(domainRoute('/api/v1/public/vitrines/autre/suivi/'+token+'/avis','ma-boutique','POST').kind,'deny');
});
