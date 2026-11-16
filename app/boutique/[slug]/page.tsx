import {redirect,notFound} from 'next/navigation';
import {prisma} from '../../../modules/storage/client';
import {isOpen} from '../../../modules/platform/public';
import {isPublicIsolatedShop} from '../../../modules/shops/publication';
import {automaticStorefrontAddress} from '../../../modules/shops/storefront-address';
import {storefrontAddress} from '../../../modules/shops/storefront-address-service';
export const dynamic='force-dynamic';
/** Compatibility for merchant links previously copied with the singular prefix. */
export default async function LegacyStoreLink({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const workspace=await prisma.workspace.findUnique({where:{slug},select:{published:true,subscriptionStatus:true,subscriptionEndsAt:true}});
 if(workspace){if(!isOpen(workspace))notFound();redirect(automaticStorefrontAddress(slug,'/boutiques/'+encodeURIComponent(slug)));}
 const shop=await prisma.shop.findUnique({where:{slug},select:{id:true,status:true,legacyWorkspaceId:true,commerce:{select:{shopId:true}},organization:{select:{ownerId:true,owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}}}});
 const subscription=shop?.organization.owner.workspace;
 if(!shop||!isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,subscriptionStatus:subscription?.subscriptionStatus||'',subscriptionEndsAt:subscription?.subscriptionEndsAt||null}))notFound();
 redirect(await storefrontAddress({id:shop.id,slug,ownerId:shop.organization.ownerId},'/vitrines/'+encodeURIComponent(slug)));
}
