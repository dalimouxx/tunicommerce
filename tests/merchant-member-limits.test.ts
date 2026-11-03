import test from 'node:test';
import assert from 'node:assert/strict';
import {countStaffSeats,assertStaffSeatLimit} from '../modules/shops/member-limits';

test('staff seats count unique active collaborators across shops, not organization owner',()=>{
 const owner='merchant-owner';
 assert.equal(countStaffSeats(['member-a','member-b','member-a',owner,owner],owner),2);
 assert.equal(countStaffSeats([owner],owner),0);
 assert.equal(countStaffSeats([],owner),0);
});
test('a null subscription seat limit is unlimited and a finite limit is enforced',()=>{
 assert.doesNotThrow(()=>assertStaffSeatLimit(100,null));
 assert.doesNotThrow(()=>assertStaffSeatLimit(1,2));
 assert.throws(()=>assertStaffSeatLimit(2,2),/Limite de collaborateurs atteinte/);
 assert.throws(()=>assertStaffSeatLimit(3,2),/Limite de collaborateurs atteinte/);
});
