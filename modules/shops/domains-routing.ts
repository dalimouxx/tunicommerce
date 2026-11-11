import {prisma} from '../storage/client';
import {isPublicIsolatedShop} from './publication';
import {automaticStoreSlug,normalizeDomain,platformHosts,storefrontRoot} from './domains-validation';
import {assertSameOrigin,HttpError} from '../auth/http';
export async function resolveStorefrontHost(host:string){
 const hostname=normalizeDomain(host);if(!hostname||process.env.STOREFRONT_DOMAIN_ROUTING!=='enabled')return null;
 if(platformHosts().includes(hostname))return null;
 const automatic=automaticStoreSlug(hostname);const root=storefrontRoot();
 if(root&&(hostname===root||hostname.endsWith('.'+root)&&!automatic))return null;
 const shop=automatic?await prisma.shop.findUnique({where:{slug:automatic},select:{slug:true,status:true,legacyWorkspaceId:true,commerce:{select:{shopId:true}},organization:{select:{owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}}}}):
  (await prisma.shopDomainBinding.findUnique({where:{hostname},select:{shop:{select:{slug:true,status:true,legacyWorkspaceId:true,commerce:{select:{shopId:true}},organization:{select:{owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}}}}}}))?.shop;
 const subscription=shop?.organization.owner.workspace;
 if(!shop||!isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,subscriptionStatus:subscription?.subscriptionStatus||'',subscriptionEndsAt:subscription?.subscriptionEndsAt||null}))return null;
 return {slug:shop.slug,hostname};
}
export function requestHostname(raw:string|null){
 if(!raw||raw.includes(',')||raw.includes('@')||raw.includes('/')||raw.includes('\\'))return null;
 const match=/^([^:]+)(?::\d{1,5})?$/.exec(raw);return match?match[1].toLowerCase():null;
}
/** Only the actual Host header is considered. Forwarded hosts never grant a tenant context. */
export async function assertPublicStorefrontOrigin(request:Request,slug:string){
 if(process.env.STOREFRONT_DOMAIN_ROUTING!=='enabled'){assertSameOrigin(request);return;}
 const host=requestHostname(request.headers.get('host'));
 if(host&&platformHosts().includes(host)){assertSameOrigin(request);return;}
 const domain=host?await resolveStorefrontHost(host):null;
 if(!domain||domain.slug!==slug||request.headers.get('origin')!=='https://'+domain.hostname)throw new HttpError(403,'Origine interdite');
}
