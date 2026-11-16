import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {domainRoute} from '../modules/shops/domain-path-policy';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('merchant, customer and admin surfaces are wired',()=>{
 assert.ok(read('app/mes-boutiques/[shopId]/shop-confirmation-desk.tsx').includes('reliabilityLabel('));
 assert.ok(read('app/vitrines/[slug]/suivi/[token]/page.tsx').includes('<ContestForm'));
 assert.ok(existsSync(new URL('../app/admin/contestations/page.tsx',import.meta.url)));
 assert.ok(read('app/admin/layout.tsx').includes('/admin/contestations'));
 assert.ok(JSON.parse(read('package.json')).scripts['reliability:rebuild']);
});
test('every checkout form tells the customer about shared delivery history',()=>{
 for(const path of ['app/vitrines/[slug]/produit/[productId]/product-cod-form.tsx','app/vitrines/[slug]/public-cart.tsx','components/public-shop.tsx'])
  assert.ok(read(path).includes('reliabilityNotice'),path);
});
test('custom domains accept a contest posted from the tracking page only',()=>{
 const api='/api/v1/public/vitrines/ma-boutique/suivi/0b0c6a6e-1111-4222-8333-944445555666/contestation';
 assert.equal(domainRoute(api,'ma-boutique','POST').kind,'pass');
 assert.equal(domainRoute(api,'ma-boutique','GET').kind,'deny');
});
