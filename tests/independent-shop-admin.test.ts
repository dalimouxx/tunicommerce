import test from 'node:test';
import assert from 'node:assert/strict';
import {independentShopAdminSummary,independentShopPublicAccess,type IndependentShopAdminEntry} from '../modules/platform/independent-shop-admin';
const now=new Date('2026-11-03T14:00:00Z');
function shop(overrides:Partial<IndependentShopAdminEntry>={}):IndependentShopAdminEntry{
 return {id:'1',name:'Boutique',slug:'boutique',status:'DRAFT',initialized:true,organization:'Org',
  owner:'Owner',email:'merchant@example.invalid',plan:'STARTER',subscriptionStatus:'ACTIVE',
  subscriptionEndsAt:new Date('2027-01-01'),...overrides};
}
test('global admin separates published flags from actually public shops',()=>{
 const rows=[shop({status:'PUBLISHED'}),shop({id:'2',status:'PUBLISHED',subscriptionEndsAt:new Date('2026-01-01')}),
  shop({id:'3',status:'DRAFT'}),shop({id:'4',status:'PUBLISHED',initialized:false})];
 const summary=independentShopAdminSummary(rows,now);
 assert.deepEqual(summary,{total:4,published:3,publiclyAccessible:1,draft:1,missingCommerce:1,inactiveSubscription:1});
});
test('admin list never confuses expired or draft with public availability',()=>{
 assert.equal(independentShopPublicAccess(shop({status:'PUBLISHED'}),now),true);
 assert.equal(independentShopPublicAccess(shop({status:'DRAFT'}),now),false);
 assert.equal(independentShopPublicAccess(shop({status:'PUBLISHED',subscriptionStatus:'SUSPENDED'}),now),false);
 assert.equal(independentShopPublicAccess(shop({status:'PUBLISHED',initialized:false}),now),false);
});
