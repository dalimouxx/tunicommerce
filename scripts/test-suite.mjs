import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Database suites reset shared tables: always run them serially on a disposable DB.
const integration=new Set([
 'order-mail-api.test.ts',
 'worker-operations.test.ts',
 'shop-home-api.test.ts',
 'shop-domains-api.test.ts',
 'merchant-shop-journey-api.test.ts',
 'platform-route-audit.test.ts',
 'landing-theme-http.test.ts',
 'shop-pages-api.test.ts',
 'account-security-api.test.ts',
 'admin-control-center.test.ts','admin-own-shop.test.ts','appearance-api.test.ts',
 'media-api.test.ts','onboarding-api.test.ts','payment-reception-api.test.ts',
 'portal-http-isolation.test.ts','portals.test.ts','postgres.test.ts',
 'priority1-http-tenant-boundary.test.ts','priority1-legacy-public-race.test.ts',
 'priority1-postgres-isolation.test.ts','product-media-api.test.ts',
 'saas-billing-api.test.ts','saas-plan-api.test.ts','team-api.test.ts','tenancy-api.test.ts'
]);
// This exercise needs a seeded backup and an explicit phase; its own workflow runs it.
const operational=new Set(['priority1-backup-drill.test.ts']);
const mode=process.argv[2]||'unit';
if(!['unit','integration'].includes(mode))throw Error('Expected unit or integration');
const root=fileURLToPath(new URL('../',import.meta.url));
const files=readdirSync(new URL('../tests/',import.meta.url))
 .filter(name=>/\.test\.(ts|mjs)$/.test(name)).sort();
for(const name of [...integration,...operational]){
 if(!files.includes(name))throw Error('Missing registered suite: '+name);
}
if(mode==='integration'){
 const database=process.env.TEST_DATABASE_URL;
 if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)
  throw Error('Integration tests require matching DATABASE_URL and TEST_DATABASE_URL on a disposable *_test database');
}
const selected=files.filter(name=>!operational.has(name)&&integration.has(name)===(mode==='integration'));
console.log(`Running ${selected.length} ${mode} test files`);
const env={...process.env};
if(mode==='unit'){
 delete env.DATABASE_URL;
 delete env.TEST_DATABASE_URL;
}
const result=spawnSync(process.execPath,[
 '--import','tsx','--test','--test-concurrency='+(mode==='integration'?1:4),
 ...selected.map(name=>'tests/'+name)
],{cwd:root,stdio:'inherit',env});
if(result.error)throw result.error;
process.exitCode=result.status??1;




