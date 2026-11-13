export const DOMAIN_RECHECK_MS=24*3600_000;
export const DOMAIN_PROOF_MAX_AGE_MS=72*3600_000;
export const DOMAIN_RETRY_MS=3600_000;
export type DomainProofHealth='UNVERIFIED'|'VERIFIED'|'DNS_UNAVAILABLE'|'REVOKED'|'OWNER_CHANGED'|'STALE';
type Binding={ownerId:string;verifiedAt:Date;proofStatus:string;lastError:string|null};
export function domainProofHealth(binding:Binding|null|undefined,ownerId:string,now=new Date()):DomainProofHealth{
 if(!binding)return 'UNVERIFIED';
 if(binding.ownerId!==ownerId||binding.proofStatus==='OWNER_CHANGED')return 'OWNER_CHANGED';
 if(binding.proofStatus!=='VERIFIED')return 'REVOKED';
 if(binding.lastError&&binding.lastError!=='DNS_UNAVAILABLE')return 'REVOKED';
 const age=now.getTime()-binding.verifiedAt.getTime();
 if(!Number.isFinite(age)||age< -60_000||age>=DOMAIN_PROOF_MAX_AGE_MS)return 'STALE';
 return binding.lastError?'DNS_UNAVAILABLE':'VERIFIED';
}
export function domainProofAllowsRouting(binding:Binding|null|undefined,ownerId:string,now=new Date()){
 const health=domainProofHealth(binding,ownerId,now);return health==='VERIFIED'||health==='DNS_UNAVAILABLE';
}
export const domainProofLabels:Record<DomainProofHealth,string>={
 UNVERIFIED:'En attente de preuve DNS',VERIFIED:'Preuve DNS à jour',DNS_UNAVAILABLE:'DNS temporairement indisponible · preuve récente conservée',
 REVOKED:'Liaison suspendue · preuve DNS absente ou invalide',OWNER_CHANGED:'Nouveau propriétaire · nouvelle preuve requise',STALE:'Preuve trop ancienne · nouvelle vérification requise'
};
