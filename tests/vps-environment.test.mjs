import test from 'node:test';
import assert from 'node:assert/strict';
import {vpsEnvironmentErrors} from '../scripts/vps-environment.mjs';
const env={POSTGRES_PASSWORD:'a'.repeat(64),APP_DATABASE_PASSWORD:'b'.repeat(64),APP_ENCRYPTION_SECRET:'c'.repeat(64),PLATFORM_DOMAIN:'platform.example.test',ACME_EMAIL:'qa@example.test'};
test('VPS preflight refuses placeholders in production and permits isolated test domains explicitly',()=>{
 assert.ok(vpsEnvironmentErrors(env).some(item=>item.startsWith('PLATFORM_DOMAIN')));
 assert.deepEqual(vpsEnvironmentErrors(env,{allowTestDomain:true}),[]);
 assert.deepEqual(vpsEnvironmentErrors({...env,PLATFORM_DOMAIN:'tunicom.demo.tn',ACME_EMAIL:'operator@demo.tn'}),[]);
 for(const domain of ['127.0.0.1','https://tunicom.demo.tn','bad host.tn','example.tn\nadmin.tn','-bad.tn'])assert.ok(vpsEnvironmentErrors({...env,PLATFORM_DOMAIN:domain}).length);
});
test('VPS preflight requires distinct URL-safe credentials without returning their values',()=>{
 for(const value of ['',"bad'password",'d'.repeat(63)]){
  const errors=vpsEnvironmentErrors({...env,APP_DATABASE_PASSWORD:value},{allowTestDomain:true});assert.ok(errors.length);
  if(value)assert.ok(!errors.join().includes(value));
 }
 assert.ok(vpsEnvironmentErrors({...env,APP_DATABASE_PASSWORD:env.POSTGRES_PASSWORD},{allowTestDomain:true}).length);
 assert.ok(vpsEnvironmentErrors({...env,SETUP_TOKEN:env.APP_ENCRYPTION_SECRET},{allowTestDomain:true}).length);
});
test('VPS routing, image tags and media modes must be explicit and valid',()=>{
 assert.ok(vpsEnvironmentErrors({...env,STOREFRONT_DOMAIN_ROUTING:'enabled'},{allowTestDomain:true}).length);
 assert.deepEqual(vpsEnvironmentErrors({...env,STOREFRONT_DOMAIN_ROUTING:'enabled',STOREFRONT_ROOT_DOMAIN:'shops.example.test'},{allowTestDomain:true}),[]);
 assert.ok(vpsEnvironmentErrors({...env,MEDIA_STORAGE_MODE:'public-files'},{allowTestDomain:true}).length);
 assert.ok(vpsEnvironmentErrors({...env,MEDIA_GC_ENABLED:'TRUE'},{allowTestDomain:true}).length);
 assert.ok(vpsEnvironmentErrors({...env,MEDIA_GC_ENABLED:'true',MEDIA_STORAGE_MODE:'database'},{allowTestDomain:true}).length);
 assert.ok(vpsEnvironmentErrors({...env,TUNICOM_IMAGE_TAG:'bad tag'},{allowTestDomain:true}).length);
});
