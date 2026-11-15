import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanComment,displayName,ratingSummary,reviewInput,reportInput,moderationInput,merchantReplyInput,reviewJsonLd} from '../modules/reviews/policy';
import {jsonLdScript} from '../modules/seo/structured-data';

test('review input requires a 1–5 rating and refuses links and oversized comments',()=>{
 const base={requestId:crypto.randomUUID(),productId:'p1',rating:5,comment:'Très bon casque'};
 assert.equal(reviewInput.safeParse(base).success,true);
 assert.equal(reviewInput.safeParse({...base,comment:''}).success,true);
 for(const rating of [0,6,4.5])assert.equal(reviewInput.safeParse({...base,rating}).success,false);
 assert.equal(reviewInput.safeParse({...base,comment:'Voir https://spam.example'}).success,false);
 assert.equal(reviewInput.safeParse({...base,comment:'www.spam.tn promo'}).success,false);
 assert.equal(reviewInput.safeParse({...base,comment:'x'.repeat(1001)}).success,false);
 assert.equal(reviewInput.safeParse({...base,extra:1}).success,false);
});
test('comments are plain text with normalised whitespace',()=>{
 assert.equal(cleanComment('  Super\u0000   produit \n\n\n\n merci  '),'Super produit\n\nmerci');
});
test('public author name never exposes the full surname',()=>{
 assert.equal(displayName('Amira Ben Ali'),'Amira B.');
 assert.equal(displayName('  sami  '),'Sami');
 assert.equal(displayName(''),'Client vérifié');
});
test('summary averages only published reviews',()=>{
 assert.deepEqual(ratingSummary([{rating:5,status:'PUBLISHED'},{rating:4,status:'PUBLISHED'},{rating:1,status:'REPORTED'},{rating:1,status:'REMOVED'}]),{count:2,average:4.5});
 assert.deepEqual(ratingSummary([]),{count:0,average:0});
});
test('merchant and admin inputs are closed',()=>{
 assert.equal(merchantReplyInput.safeParse({action:'reply',reviewId:crypto.randomUUID(),reply:'Merci !'}).success,true);
 assert.equal(merchantReplyInput.safeParse({action:'reply',reviewId:crypto.randomUUID(),reply:'x'.repeat(601)}).success,false);
 assert.equal(reportInput.safeParse({action:'report',reviewId:crypto.randomUUID(),reason:'ABUSE'}).success,true);
 assert.equal(reportInput.safeParse({action:'report',reviewId:crypto.randomUUID(),reason:'DISLIKE'}).success,false);
 assert.equal(moderationInput.safeParse({reviewId:crypto.randomUUID(),decision:'RESTORE'}).success,true);
 assert.equal(moderationInput.safeParse({reviewId:crypto.randomUUID(),decision:'DELETE'}).success,false);
});
test('rating data for Google only exists with published reviews and stays script-safe',()=>{
 assert.equal(reviewJsonLd({count:0,average:0},[]),null);
 const data=reviewJsonLd({count:2,average:4.5},[{authorName:'Amira B.',rating:5,comment:'</script><b>x',createdAt:new Date('2026-11-15T10:00:00Z')}])!;
 assert.deepEqual(data.aggregateRating,{'@type':'AggregateRating',ratingValue:'4.5',reviewCount:2,bestRating:5,worstRating:1});
 assert.equal(data.review[0].reviewRating.ratingValue,5);
 assert.ok(!jsonLdScript(data).includes('</script'));
});
