import test from 'node:test';
import assert from 'node:assert/strict';
import {domainProofHealth,domainProofAllowsRouting,DOMAIN_PROOF_MAX_AGE_MS} from '../modules/shops/domain-health';
const now=new Date('2026-11-13T18:00:00Z'),binding={ownerId:'owner',verifiedAt:now,proofStatus:'VERIFIED',lastError:null};
test('Personal domains require a recent proof from the current owner',()=>{
 assert.equal(domainProofHealth(null,'owner',now),'UNVERIFIED');assert.equal(domainProofAllowsRouting(null,'owner',now),false);
 assert.equal(domainProofHealth(binding,'owner',now),'VERIFIED');assert.equal(domainProofAllowsRouting(binding,'owner',now),true);
 assert.equal(domainProofHealth(binding,'new-owner',now),'OWNER_CHANGED');assert.equal(domainProofAllowsRouting(binding,'new-owner',now),false);
});
test('A DNS outage preserves a recent proof but cannot extend its seventy-two-hour maximum age',()=>{
 const row={...binding,lastError:'DNS_UNAVAILABLE'};
 assert.equal(domainProofHealth(row,'owner',now),'DNS_UNAVAILABLE');assert.equal(domainProofAllowsRouting(row,'owner',now),true);
 assert.equal(domainProofAllowsRouting(row,'owner',new Date(now.getTime()+DOMAIN_PROOF_MAX_AGE_MS-1)),true);
 assert.equal(domainProofHealth(row,'owner',new Date(now.getTime()+DOMAIN_PROOF_MAX_AGE_MS)),'STALE');
 assert.equal(domainProofAllowsRouting(row,'owner',new Date(now.getTime()+DOMAIN_PROOF_MAX_AGE_MS)),false);
});
test('Revocation, ownership change, unknown state and invalid clocks cannot grant routing',()=>{
 for(const proofStatus of ['REVOKED','OWNER_CHANGED','UNKNOWN'])assert.equal(domainProofAllowsRouting({...binding,proofStatus},'owner',now),false);
 assert.equal(domainProofAllowsRouting({...binding,lastError:'UNKNOWN'},'owner',now),false);
 assert.equal(domainProofAllowsRouting({...binding,verifiedAt:new Date(NaN)},'owner',now),false);
 assert.equal(domainProofAllowsRouting({...binding,verifiedAt:new Date(now.getTime()+60_001)},'owner',now),false);
 assert.equal(domainProofAllowsRouting({...binding,verifiedAt:new Date(now.getTime()+60_000)},'owner',now),true);
});
