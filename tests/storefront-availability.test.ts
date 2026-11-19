import test from 'node:test';
import assert from 'node:assert/strict';
import {isOpen,storefrontAvailability} from '../modules/platform/public';

const now=new Date('2026-11-19T12:00:00Z');
const later=new Date('2026-12-19T12:00:00Z'),earlier=new Date('2026-11-01T12:00:00Z');

test('A shop is visible only when published with an active, unexpired subscription; otherwise the reason is named',()=>{
 assert.deepEqual(storefrontAvailability({published:true,subscriptionStatus:'ACTIVE',subscriptionEndsAt:later},now),{open:true,reason:null});
 assert.deepEqual(storefrontAvailability({published:true,subscriptionStatus:'TRIAL',subscriptionEndsAt:later},now),{open:true,reason:null});
 assert.deepEqual(storefrontAvailability({published:false,subscriptionStatus:'ACTIVE',subscriptionEndsAt:later},now),{open:false,reason:'unpublished'});
 assert.deepEqual(storefrontAvailability({published:true,subscriptionStatus:'ACTIVE',subscriptionEndsAt:earlier},now),{open:false,reason:'subscription'});
 assert.deepEqual(storefrontAvailability({published:true,subscriptionStatus:'SUSPENDED',subscriptionEndsAt:later},now),{open:false,reason:'subscription'});
 assert.deepEqual(storefrontAvailability({published:true,subscriptionStatus:'TRIAL',subscriptionEndsAt:null},now),{open:false,reason:'subscription'});
 // Accepts the ISO string the admin panel receives.
 assert.deepEqual(storefrontAvailability({published:true,subscriptionStatus:'ACTIVE',subscriptionEndsAt:later.toISOString()},now),{open:true,reason:null});
 // Same answer as the check the public pages use.
 for(const status of ['ACTIVE','TRIAL','CANCELLED'])for(const published of [true,false])for(const ends of [later,earlier,null])
  assert.equal(storefrontAvailability({published,subscriptionStatus:status,subscriptionEndsAt:ends},now).open,isOpen({published,subscriptionStatus:status,subscriptionEndsAt:ends},now));
});
