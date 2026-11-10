import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Global admin and merchant navigation require explicit independent portal login',()=>{
 const admin=readFileSync('app/admin/layout.tsx','utf8');
 const merchant=readFileSync('components/commerce-app.tsx','utf8');
 const shops=readFileSync('app/mes-boutiques/page.tsx','utf8');
 assert.ok(admin.includes('href="/connexion/boutique"'));
 assert.equal(merchant.includes('href="/connexion/admin"'),false);
 assert.ok(merchant.includes('href="/connexion/boutique"'));
 assert.ok(!admin.includes('href="/mes-boutiques"'));
 assert.ok(shops.includes("'/connexion/admin'"));
});
