import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticStorefrontAddress,automaticStorefrontHostname} from '../modules/shops/storefront-address';
import {newShopInput} from '../modules/shops/validation';
import {platformHosts} from '../modules/shops/domains-validation';
const env={STOREFRONT_DOMAIN_ROUTING:'enabled',STOREFRONT_ROOT_DOMAIN:'tunicom.shop'};

test('only the configured application origin is trusted as a platform host',()=>{
 assert.deepEqual(platformHosts({APP_URL:'https://tunicom.shop',RENDER_EXTERNAL_URL:'https://old-host.example'}),['tunicom.shop']);
 assert.deepEqual(platformHosts({RENDER_EXTERNAL_URL:'https://old-host.example'}),[]);
});
test('automatic storefront addresses use one safe subdomain label and retain paths before activation',()=>{
 assert.equal(automaticStorefrontHostname('el-benna',env),'el-benna.tunicom.shop');
 assert.equal(automaticStorefrontAddress('el-benna','/boutiques/el-benna',env),'https://el-benna.tunicom.shop');
 assert.equal(automaticStorefrontAddress('el-benna','/boutiques/el-benna',{...env,STOREFRONT_DOMAIN_ROUTING:'disabled'}),'/boutiques/el-benna');
 for(const slug of ['admin','www','api','mail','evil.host','bad/path','UPPER','a'])assert.equal(automaticStorefrontHostname(slug,env),null,slug);
});
test('new shops cannot reserve platform service hostnames',()=>{
 const input={organizationId:'00000000-0000-4000-8000-000000000000',name:'Boutique',slug:'el-benna'};
 assert.equal(newShopInput.safeParse(input).success,true);
 for(const slug of ['admin','www','api','mail','smtp','support','status','app'])assert.equal(newShopInput.safeParse({...input,slug}).success,false);
});
