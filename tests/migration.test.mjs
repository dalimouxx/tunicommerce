import test from 'node:test';
import assert from 'node:assert/strict';
import {migrationUrl} from '../scripts/migration-url.mjs';
test('Migration connection removes Neon pooler while preserving database, credentials and TLS',()=>{
 const pooled='postgresql://test:fixture@ep-demo-pooler.eu-central-1.aws.neon.tech/db?sslmode=require';
 const direct=new URL(migrationUrl(pooled));assert.equal(direct.hostname,'ep-demo.eu-central-1.aws.neon.tech');assert.equal(direct.username,'test');assert.equal(direct.password,'fixture');assert.equal(direct.pathname,'/db');assert.equal(direct.searchParams.get('sslmode'),'require');assert.ok(pooled.includes('-pooler.'));
});
test('Explicit direct URL takes precedence and other PostgreSQL hosts are unchanged',()=>{
 const local='postgresql://test:fixture@localhost:5432/app_test';assert.equal(migrationUrl(local),local);assert.equal(migrationUrl('unused',local),local);assert.throws(()=>migrationUrl());
});
