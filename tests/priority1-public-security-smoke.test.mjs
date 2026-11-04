import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_ORIGIN,checkAnonymousBoundaries} from '../scripts/priority1-public-security-smoke.mjs';
const delay=async()=>{};
const response=(status,location=null)=>({status,headers:{get:(name)=>name==='location'?location:null}});
test('protected API and admin pages reject anonymous clients without sending cookies',async()=>{
 const seen=[];
 const result=await checkAnonymousBoundaries({delay,fetcher:async(url,options)=>{
  seen.push(url);
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'manual');
  assert.equal(options.headers.Cookie,undefined);
  return response(url.endsWith('/admin')?307:401,url.endsWith('/admin')?'/login':null);
 }});
 assert.deepEqual(result,{ok:true,checks:6});
 assert.equal(seen.length,6);
 assert.ok(seen.every(url=>url.startsWith(PUBLIC_ORIGIN)));
});
test('API accidentally becoming public or admin redirecting offsite fails closed',async()=>{
 await assert.rejects(checkAnonymousBoundaries({delay,attempts:1,fetcher:async()=>response(200)}),/HTTP 401/);
 await assert.rejects(checkAnonymousBoundaries({delay,attempts:1,fetcher:async url=>
  response(url.endsWith('/admin')?307:401,'https://wrong.example/login')
 }),/Unexpected admin redirect destination/);
 await assert.rejects(checkAnonymousBoundaries({origin:'https://evil.example',delay}),/pinned/);
});

test('all merchant APIs remain covered by anonymous read-only smoke checks',async()=>{
 const calls=[];
 await checkAnonymousBoundaries({delay,fetcher:async(url,options)=>{
  calls.push({url,options});
  return response(url.endsWith('/admin')?307:401,url.endsWith('/admin')?'/login':null);
 }});
 for(const suffix of ['/orders','/dispatch-manifest','/cod-exceptions']){
  assert.ok(calls.some(call=>call.url.endsWith(suffix)));
 }
 assert.equal(calls.some(call=>call.options.method!=='GET'),false);
 assert.equal(calls.some(call=>call.options.headers.Cookie!==undefined),false);
});
