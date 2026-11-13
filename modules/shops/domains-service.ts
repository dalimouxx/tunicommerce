import {randomBytes} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {pageOwner} from './page-service';
import {HttpError} from '../auth/http';
import {consumeAttempt} from '../auth/service';
import {domainMutation,proofPrefix,reservedDomain,storefrontRoot,automaticStoreSlug,normalizeDomain} from './domains-validation';
import {checkDomainProof,type TxtLookup} from './domains-dns';
import type {z} from 'zod';
import {domainProofHealth,DOMAIN_RECHECK_MS} from './domain-health';
const token=()=>randomBytes(32).toString('hex');const expires=()=>new Date(Date.now()+7*86400000);
export async function domainOverview(userId:string,shopId:string){
 const shop=await pageOwner(userId,shopId);
 const claims=await prisma.shopDomainClaim.findMany({where:{shopId},orderBy:{createdAt:'asc'},include:{binding:true}});
 const root=storefrontRoot();const candidate=root?normalizeDomain(shop.slug+'.'+root):null;const automaticHostname=candidate&&automaticStoreSlug(candidate)===shop.slug?candidate:null;
 return {automaticHostname,automaticUnavailableReason:root&&!automaticHostname?'Ce lien ne permet pas un sous-domaine automatique. Un domaine personnel peut être utilisé.':null,routingEnabled:process.env.STOREFRONT_DOMAIN_ROUTING==='enabled',claims:claims.map(claim=>{
  const requiresNewProof=claim.ownerId!==userId||!!claim.binding&&(claim.binding.ownerId!==userId||claim.binding.proofStatus==='OWNER_CHANGED');
  return {id:claim.id,hostname:claim.hostname,recordName:proofPrefix+claim.hostname,recordValue:requiresNewProof?'':'tunicom='+claim.token,
   expiresAt:claim.expiresAt.toISOString(),verifiedAt:claim.binding?.verifiedAt.toISOString()||null,requiresNewProof,
   health:requiresNewProof?'OWNER_CHANGED' as const:domainProofHealth(claim.binding,userId),
   lastCheckedAt:claim.binding?.lastCheckedAt?.toISOString()||null,nextCheckAt:claim.binding?.nextCheckAt.toISOString()||null};
 })};
}
export async function changeShopDomain(userId:string,shopId:string,input:z.infer<typeof domainMutation>,lookup?:TxtLookup){
 await pageOwner(userId,shopId);
 if(input.action==='verify'){
  const claim=await prisma.shopDomainClaim.findFirst({where:{id:input.id,shopId},include:{binding:true}});if(!claim)throw new HttpError(404,'Domaine introuvable');
  if(claim.ownerId!==userId||claim.binding&&(claim.binding.ownerId!==userId||claim.binding.proofStatus==='OWNER_CHANGED'))throw new HttpError(409,'Le propriétaire a changé. Renouvelez le code puis ajoutez la nouvelle valeur TXT avant de vérifier.');
  if(!claim.binding&&claim.expiresAt<=new Date())throw new HttpError(409,'Ce code a expiré. Renouvelez-le avant de modifier le DNS.');
  await consumeAttempt('domain-proof:'+userId,20);await checkDomainProof(claim.hostname,claim.token,lookup);
  try{return await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Shop" WHERE id=${shopId} FOR UPDATE`;await pageOwner(userId,shopId,tx);
   const current=await tx.shopDomainClaim.findFirst({where:{id:input.id,shopId},include:{binding:true}});
   if(!current||current.ownerId!==userId||current.token!==claim.token||current.binding&&(current.binding.ownerId!==userId||current.binding.proofStatus==='OWNER_CHANGED')||!current.binding&&current.expiresAt<=new Date())throw new HttpError(409,'Le code ou le propriétaire a changé. Actualisez avant de vérifier.');
   const bound=await tx.shopDomainBinding.findUnique({where:{hostname:claim.hostname}});
   if(bound&&bound.claimId!==claim.id)throw new HttpError(409,'Ce domaine est déjà rattaché. Contactez l’administration pour un transfert vérifié.');
   const now=new Date(),proof={ownerId:userId,verifiedAt:now,lastCheckedAt:now,nextCheckAt:new Date(now.getTime()+DOMAIN_RECHECK_MS),proofStatus:'VERIFIED',lastError:null,checkLeaseId:null,checkLockedUntil:null};
   await tx.shopDomainBinding.upsert({where:{hostname:claim.hostname},create:{hostname:claim.hostname,shopId,claimId:claim.id,...proof},update:proof});return {ok:true};
  });}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new HttpError(409,'Ce domaine est déjà rattaché.');throw error;}
 }
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Shop" WHERE id=${shopId} FOR UPDATE`;await pageOwner(userId,shopId,tx);
  if(input.action==='add'){
   if(reservedDomain(input.hostname))throw new HttpError(400,'Cette adresse est réservée à la plateforme.');
   const existing=await tx.shopDomainClaim.findUnique({where:{shopId_hostname:{shopId,hostname:input.hostname}}});if(existing)return {ok:true};
   if(await tx.shopDomainClaim.count({where:{shopId}})>=5)throw new HttpError(409,'Limite de cinq domaines par boutique atteinte.');
   await tx.shopDomainClaim.create({data:{shopId,ownerId:userId,hostname:input.hostname,token:token(),expiresAt:expires()}});return {ok:true};
  }
  const claim=await tx.shopDomainClaim.findFirst({where:{id:input.id,shopId},include:{binding:true}});if(!claim)throw new HttpError(404,'Domaine introuvable');
  if(input.action==='remove'){await tx.shopDomainClaim.delete({where:{id:claim.id}});return {ok:true};}
  const ownerChanged=claim.ownerId!==userId||claim.binding&&(claim.binding.ownerId!==userId||claim.binding.proofStatus==='OWNER_CHANGED');
  if(claim.binding&&!ownerChanged)throw new HttpError(409,'Un domaine déjà vérifié ne nécessite pas de nouveau code.');
  if(claim.binding)await tx.shopDomainBinding.delete({where:{hostname:claim.hostname}});
  await tx.shopDomainClaim.update({where:{id:claim.id},data:{ownerId:userId,token:token(),expiresAt:expires()}});return {ok:true};
 });
}
