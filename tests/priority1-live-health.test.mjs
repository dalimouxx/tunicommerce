import test from 'node:test';
import assert from 'node:assert/strict';
import {HEALTH_URL,checkPublicHealth} from '../scripts/priority1-live-health.mjs';

const noDelay=async()=>{};
const good=()=>({status:200,json:async()=>({server:'ok',database:'ok'})});
test('healthy Postgres response succeeds with no secrets',async()=>{
 const result=await checkPublicHealth({fetcher:async url=>{
  assert.equal(url,HEALTH_URL);
  return good();
 },delay:noDelay});
 assert.deepEqual(result,{ok:true,attempts:1});
});
test('transient cold-start errors are retried, then return success',async()=>{
 let n=0;
 const result=await checkPublicHealth({attempts:4,delay:noDelay,fetcher:async()=>{
  n++;if(n<=2)throw Error('cold start');
  return good();
 }});
 assert.equal(result.attempts,3);
});
test('HTTP 200 with database unavailable never counts as healthy',async()=>{
 await assert.rejects(checkPublicHealth({
  attempts:2,delay:noDelay,fetcher:async()=>({
   status:200,json:async()=>({server:'ok',database:'unavailable'})
  })
 }),/database unavailable/);
});
test('HTTP 503, invalid body, or non-approved URL fail closed',async()=>{
 await assert.rejects(checkPublicHealth({
  attempts:1,fetcher:async()=>({status:503,json:async()=>({})})
 }),/503/);
 await assert.rejects(checkPublicHealth({
  attempts:1,fetcher:async()=>({status:200,json:async()=>{throw Error('Not JSON');}})
 }),/Not JSON/);
 await assert.rejects(checkPublicHealth({url:'https://attacker.example.test/api/health',
  attempts:1,fetcher:async()=>good()}),/approved endpoint/);
});
