import test from 'node:test';
import assert from 'node:assert/strict';
import {privateTrackingPath} from '../modules/shops/public-tracking-link';
const token='11111111-1111-4111-8111-111111111111';

test('private receipt links are scoped to a store and never leak through query strings',()=>{
 const url=privateTrackingPath('boutique-test',token);
 assert.equal(url,'/vitrines/boutique-test/suivi/'+token);
 assert.equal(privateTrackingPath('boutique été',token),'/vitrines/boutique%20%C3%A9t%C3%A9/suivi/'+token);
 assert.equal(url?.includes('?'),false);
 assert.equal(url?.includes('22123456'),false);
});
test('only actual v4 bearer tokens may be offered to the buyer',()=>{
 for(const invalid of ['', 'test', '11111111-1111-1111-8111-111111111111',
  'javascript:alert(1)', '11111111-1111-4111-1111-111111111111'])
  assert.equal(privateTrackingPath('test',invalid),null);
 assert.equal(privateTrackingPath('',token),null);
 assert.equal(privateTrackingPath('test\nheader',token),null);
 assert.equal(privateTrackingPath('x'.repeat(181),token),null);
});
