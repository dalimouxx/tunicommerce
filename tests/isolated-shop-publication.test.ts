import test from 'node:test';
import assert from 'node:assert/strict';
import {canPublishIsolatedShop,isPublicIsolatedShop} from '../modules/shops/publication';

const future=new Date('2027-01-01T00:00:00Z');
const now=new Date('2026-11-03T10:00:00Z');
test('draft shop never resolves as public even with paid subscription',()=>{
 assert.equal(isPublicIsolatedShop({status:'DRAFT',legacyWorkspaceId:null,initialized:true,
 subscriptionStatus:'ACTIVE',subscriptionEndsAt:future},now),false);
});
test('published shop requires current subscription and isolated commerce',()=>{
 const base={status:'PUBLISHED',legacyWorkspaceId:null,initialized:true,subscriptionStatus:'ACTIVE',subscriptionEndsAt:future};
 assert.equal(isPublicIsolatedShop(base,now),true);
 assert.equal(isPublicIsolatedShop({...base,subscriptionEndsAt:new Date('2026-01-01')},now),false);
 assert.equal(isPublicIsolatedShop({...base,subscriptionStatus:'CANCELLED'},now),false);
 assert.equal(isPublicIsolatedShop({...base,legacyWorkspaceId:'old'},now),false);
 assert.equal(isPublicIsolatedShop({...base,initialized:false},now),false);
});
test('owner publishing requires initialized nonempty catalog and valid subscription',()=>{
 const base={legacyWorkspaceId:null,memberActive:true,memberRole:'OWNER',initialized:true,activeProducts:1,subscriptionStatus:'TRIAL',subscriptionEndsAt:future};
 assert.equal(canPublishIsolatedShop(base,now),true);
 assert.equal(canPublishIsolatedShop({...base,memberRole:'MANAGER'},now),false);
 assert.equal(canPublishIsolatedShop({...base,activeProducts:0},now),false);
 assert.equal(canPublishIsolatedShop({...base,subscriptionEndsAt:null},now),false);
});
