import {prisma} from '../storage/client';
import {domainProofAllowsRouting} from './domain-health';
import {automaticStorefrontAddress} from './storefront-address';
export async function primaryStorefrontHostname(shopId:string,ownerId:string){
 if(process.env.STOREFRONT_DOMAIN_ROUTING!=='enabled')return null;
 const binding=await prisma.shopDomainBinding.findFirst({where:{shopId,primary:true},include:{claim:{select:{ownerId:true}}}});
 return binding&&binding.claim.ownerId===ownerId&&domainProofAllowsRouting(binding,ownerId)?binding.hostname:null;
}
export async function storefrontAddress(shop:{id:string;slug:string;ownerId:string},fallback:string){
 const primary=await primaryStorefrontHostname(shop.id,shop.ownerId);
 return primary?'https://'+primary:automaticStorefrontAddress(shop.slug,fallback);
}
export async function storefrontAddresses(shops:{id:string;slug:string;ownerId:string;fallback:string}[]){
 const result=new Map(shops.map(shop=>[shop.id,automaticStorefrontAddress(shop.slug,shop.fallback)]));
 if(process.env.STOREFRONT_DOMAIN_ROUTING!=='enabled'||!shops.length)return result;
 const owners=new Map(shops.map(shop=>[shop.id,shop.ownerId]));
 const bindings=await prisma.shopDomainBinding.findMany({where:{shopId:{in:[...owners.keys()]},primary:true},include:{claim:{select:{ownerId:true}}}});
 for(const binding of bindings){const owner=owners.get(binding.shopId);if(owner&&binding.claim.ownerId===owner&&domainProofAllowsRouting(binding,owner))result.set(binding.shopId,'https://'+binding.hostname);}
 return result;
}
