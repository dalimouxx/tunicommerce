import test from 'node:test';
import assert from 'node:assert/strict';
import {countMerchantShopSlots,assertShopSlotLimit} from '../modules/shops/plan-limits';

test('counts a legacy shop as a slot until it has been linked, then counts linked record once',()=>{
 assert.equal(countMerchantShopSlots(1,true),2);
 assert.equal(countMerchantShopSlots(2,false),2);
 assert.equal(countMerchantShopSlots(0,true),1);
 assert.equal(countMerchantShopSlots(0,false),0);
});
test('rejects at limit, allows unlimited plans without introducing made-up tiers',()=>{
 assert.doesNotThrow(()=>assertShopSlotLimit(2,null));
 assert.doesNotThrow(()=>assertShopSlotLimit(1,2));
 assert.throws(()=>assertShopSlotLimit(2,2),/Limite de boutiques/);
 assert.throws(()=>assertShopSlotLimit(3,2),/Limite de boutiques/);
});
