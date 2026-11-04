import test from 'node:test';
import assert from 'node:assert/strict';
import {DIRECTORY_PAGE_SIZE,directoryHref,directoryPage,subscriptionDirectoryQuery} from '../modules/platform/subscription-directory';
import {csvRow} from '../modules/billing/csv-export';
const now=new Date('2026-11-04T10:00:00Z');
test('subscription directory filters are exhaustive and mutually exclusive',()=>{
 const get=(statut:string)=>subscriptionDirectoryQuery({statut},now).where;
 const first=(statut:string)=>{const and=get(statut).AND;if(!Array.isArray(and))throw Error('Expected AND array');return and[0];};
 assert.deepEqual(first('valid'),{
  subscriptionStatus:{in:['ACTIVE','TRIAL']},
  subscriptionEndsAt:{gt:new Date('2026-11-11T10:00:00.000Z')}
 });
 assert.deepEqual(first('expiring'),{
  subscriptionStatus:{in:['ACTIVE','TRIAL']},
  subscriptionEndsAt:{gt:now,lte:new Date('2026-11-11T10:00:00.000Z')}
 });
 assert.deepEqual(first('suspended'),{subscriptionStatus:{in:['SUSPENDED','CANCELLED']}});
 assert.ok(JSON.stringify(get('expired')).includes('notIn'));
});
test('query and pagination cannot create an unbounded export or expensive offset',()=>{
 const a=subscriptionDirectoryQuery({page:'999999999999',statut:'invalid',recherche:'  =1+2  '},now);
 assert.equal(a.page,1);
 assert.equal(a.status,'all');
 assert.equal(a.search,'=1+2');
 assert.equal(subscriptionDirectoryQuery({page:'0004'},now).page,1);
 assert.equal(directoryPage(900,101).page,3);
 assert.equal(DIRECTORY_PAGE_SIZE,50);
 const href=directoryHref('/admin/abonnements/complet',{status:'expiring',search:'A&B'},2);
 assert.equal(new URL(href,'https://test.local').searchParams.get('recherche'),'A&B');
});
test('export uses central CSV formula and row injection protection',()=>{
 const line=csvRow(['=HYPERLINK("secret")','evil\r\nrow']);
 assert.equal(line.startsWith('"\''),true);
 assert.equal(line.includes('\nrow'),false);
});
