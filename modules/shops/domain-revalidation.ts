import {randomUUID} from 'node:crypto';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {checkDomainProof,resolveDomainProof,type TxtLookup} from './domains-dns';
import {DOMAIN_RECHECK_MS,DOMAIN_RETRY_MS} from './domain-health';

/** Network lookups happen outside transactions; leases and snapshot checks discard stale results. */
export async function revalidateDomainBindings(lookup:TxtLookup=resolveDomainProof,now=new Date()){
 const totals={enabled:process.env.STOREFRONT_DOMAIN_ROUTING==='enabled',scanned:0,verified:0,revoked:0,unavailable:0,ownerChanged:0,superseded:0};
 if(!totals.enabled)return totals;
 const leaseId=randomUUID(),until=new Date(now.getTime()+90_000),started=Date.now();
 const leased=await prisma.$queryRaw<{hostname:string;shopId:string;claimId:string}[]>`
  WITH candidates AS MATERIALIZED (SELECT "hostname" FROM "ShopDomainBinding" WHERE "nextCheckAt"<=${now}
   AND ("checkLockedUntil" IS NULL OR "checkLockedUntil"<=${now}) ORDER BY "nextCheckAt","hostname" LIMIT 5 FOR UPDATE SKIP LOCKED)
  UPDATE "ShopDomainBinding" SET "checkLeaseId"=${leaseId},"checkLockedUntil"=${until}
  WHERE "hostname" IN (SELECT "hostname" FROM candidates)
  RETURNING "hostname","shopId","claimId"`;
 totals.scanned=leased.length;
 for(const lease of leased){
  const before=await prisma.shopDomainBinding.findUnique({where:{hostname:lease.hostname},include:{claim:true,shop:{select:{organization:{select:{ownerId:true}}}}}});
  if(!before||before.checkLeaseId!==leaseId||before.claimId!==lease.claimId){totals.superseded++;continue;}
  let outcome:'verified'|'revoked'|'unavailable'|'ownerChanged'='verified';
  if(before.ownerId!==before.shop.organization.ownerId||before.claim.ownerId!==before.shop.organization.ownerId||before.proofStatus==='OWNER_CHANGED')outcome='ownerChanged';
  else try{await checkDomainProof(before.hostname,before.claim.token,lookup);}catch(error){outcome=error instanceof HttpError&&error.status===409?'revoked':'unavailable';}
  const saved=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "Shop" WHERE "id"=${lease.shopId} FOR UPDATE`;
   const current=await tx.shopDomainBinding.findUnique({where:{hostname:lease.hostname},include:{claim:true,shop:{select:{organization:{select:{ownerId:true}}}}}});
   const finished=new Date(now.getTime()+Math.max(0,Date.now()-started));
   if(!current||current.checkLeaseId!==leaseId||current.claimId!==lease.claimId||!current.checkLockedUntil||current.checkLockedUntil<=finished||current.claim.token!==before.claim.token||current.verifiedAt.getTime()!==before.verifiedAt.getTime())return false;
   if(current.ownerId!==current.shop.organization.ownerId||current.claim.ownerId!==current.shop.organization.ownerId||current.proofStatus==='OWNER_CHANGED')outcome='ownerChanged';
   const data={checkLeaseId:null,checkLockedUntil:null,lastCheckedAt:finished,
    nextCheckAt:new Date(finished.getTime()+(outcome==='verified'||outcome==='ownerChanged'?DOMAIN_RECHECK_MS:DOMAIN_RETRY_MS)),
    ...(outcome==='verified'?{verifiedAt:finished,proofStatus:'VERIFIED',lastError:null}:
     outcome==='revoked'?{proofStatus:'REVOKED',lastError:'TXT_MISMATCH'}:
     outcome==='ownerChanged'?{proofStatus:'OWNER_CHANGED',lastError:'OWNER_CHANGED'}:{lastError:'DNS_UNAVAILABLE'})};
   const result=await tx.shopDomainBinding.updateMany({where:{hostname:lease.hostname,checkLeaseId:leaseId,claimId:lease.claimId,checkLockedUntil:{gt:finished}},data});
   return result.count===1;
  });
  if(saved)totals[outcome]++;else totals.superseded++;
 }
 return totals;
}
