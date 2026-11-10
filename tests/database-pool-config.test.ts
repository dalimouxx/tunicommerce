import test from 'node:test';
import assert from 'node:assert/strict';
import {databasePoolConfig} from '../modules/storage/pool-config';

test('runtime pooling translates Prisma connection limits and keeps credentials and TLS settings',()=>{
 const config=databasePoolConfig('postgresql://test:fixture%40secret@database.example:5432/app?sslmode=verify-full&connection_limit=8&pool_timeout=12&schema=tenant_data');
 assert.equal(config.max,8);assert.equal(config.connectionTimeoutMillis,12000);
 const url=new URL(config.connectionString);
 assert.equal(url.password,'fixture%40secret');assert.equal(url.pathname,'/app');
 assert.equal(url.searchParams.get('sslmode'),'verify-full');
 assert.equal(url.searchParams.has('connection_limit'),false);
 assert.equal(url.searchParams.has('pool_timeout'),false);
 assert.equal(url.searchParams.has('schema'),false);assert.equal(config.schema,'tenant_data');
 assert.equal(config.idleTimeoutMillis,30000);
});

test('missing configuration cannot connect to a machine-default PostgreSQL database',()=>{
 const config=databasePoolConfig(undefined),url=new URL(config.connectionString);
 assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'1');
 assert.equal(config.max,5);assert.equal(config.connectionTimeoutMillis,5000);
 assert.equal(config.schema,'public');
 for(const raw of ['not a url','https://database.example/app',
  'postgresql://host/db?connection_limit=0','postgresql://host/db?connection_limit=999',
  'postgresql://host/db?pool_timeout=0','postgresql://host/db?pool_timeout=Infinity'])
  assert.throws(()=>databasePoolConfig(raw));
});
