import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,newSession,digest,secretMatches} from '../modules/auth/crypto';
import {assertSameOrigin,readJson,HttpError} from '../modules/auth/http';
import {ownerInput} from '../modules/auth/validation';
test('Password hashing uses random salts and rejects wrong passwords',async()=>{const a=await hashPassword('only-for-tests-123');const b=await hashPassword('only-for-tests-123');assert.notEqual(a,b);assert.equal(await verifyPassword('only-for-tests-123',a),true);assert.equal(await verifyPassword('wrong',a),false);assert.equal(await verifyPassword('x','corrupted'),false);});
test('Opaque session tokens are random and only their digest is stored',()=>{const a=newSession();const b=newSession();assert.notEqual(a.token,b.token);assert.notEqual(a.token,a.tokenHash);assert.equal(a.tokenHash,digest(a.token));assert.ok(a.expiresAt.getTime()>Date.now()+6*86400000);assert.equal(secretMatches('a','a'),true);assert.equal(secretMatches('a','ab'),false);});
test('Unsafe origins and attacker-controlled hosts are rejected',()=>{process.env.APP_URL='https://test.local';assert.doesNotThrow(()=>assertSameOrigin(new Request('http://localhost/api',{headers:{origin:'https://test.local'}})));assert.throws(()=>assertSameOrigin(new Request('https://evil.test/api',{headers:{origin:'https://evil.test',host:'evil.test'}})),HttpError);assert.throws(()=>assertSameOrigin(new Request('https://test.local/api')),HttpError);});
test('JSON reader enforces actual byte limit without Content-Length',async()=>{const req=new Request('https://test.local',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({s:'é'.repeat(20)})});await assert.rejects(readJson(req,30),(e:unknown)=>e instanceof HttpError&&e.status===413);});
test('Invalid JSON and content types have controlled errors',async()=>{await assert.rejects(readJson(new Request('https://test.local',{method:'POST',body:'hello'})),(e:unknown)=>e instanceof HttpError&&e.status===415);await assert.rejects(readJson(new Request('https://test.local',{method:'POST',headers:{'content-type':'application/json'},body:'{'})),(e:unknown)=>e instanceof HttpError&&e.status===400);});
test('Owner setup requires a long password and normalizes email',()=>{const valid={email:' OWNER@EXAMPLE.TEST ',name:'Owner',password:'test-pass-long-123',token:'x'.repeat(64)};assert.equal(ownerInput.parse(valid).email,'owner@example.test');assert.throws(()=>ownerInput.parse({...valid,password:'short'}));assert.throws(()=>ownerInput.parse({...valid,token:'short'}));});

test('Public catalogue uses an explicit allowlist and excludes private commerce data',async()=>{
 const {publicCatalog,isOpen}=await import('../modules/platform/public');
 const {initialState}=await import('../modules/commerce/seed');
 const state=initialState();const publicData=publicCatalog(state);
 assert.deepEqual(Object.keys(publicData).sort(),['bannerUrl','demo','description','logoUrl','name','phone','products','shipping','zones']);
 assert.deepEqual(Object.keys(publicData.products[0]).sort(),['available','category','description','id','imageUrl','name','offers','price','variant']);
 // Quantity offers expose only quantity, total price, label and saving (never cost or stock).
 state.products[0].quantityOffers=[{quantity:2,price:state.products[0].price*2-1000,label:'Promo'}];
 assert.deepEqual(Object.keys(publicCatalog(state).products[0].offers[1]).sort(),['label','price','quantity','saving']);
 assert.equal(JSON.stringify(publicData).includes('customerSnapshot'),false);
 const shop={published:true,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date('2030-01-01')};
 assert.equal(isOpen(shop,new Date('2026-01-01')),true);
 for(const override of [{published:false},{subscriptionStatus:'SUSPENDED'},{subscriptionEndsAt:null},{subscriptionEndsAt:new Date('2020-01-01')}])assert.equal(isOpen({...shop,...override},new Date('2026-01-01')),false);
});
