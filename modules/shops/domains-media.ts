import {prisma} from '../storage/client';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {readMediaContent,mediaReadSelect} from '../media/content-store';
import {isOpen} from '../platform/public';

/** Called only after public-host authorization; sessions never grant access to another asset. */
export async function storefrontDomainMedia(slug:string,path:string){
 const shop=await prisma.shop.findUnique({where:{slug},select:{commerce:{select:{data:true}},legacyWorkspaceId:true,legacyWorkspace:{select:{data:true,ownerId:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true}},organization:{select:{ownerId:true}}}});
 if(!shop)return null;
 const workspace=shop.legacyWorkspace;
 if(shop.legacyWorkspaceId&&(!workspace||workspace.ownerId!==shop.organization.ownerId||!isOpen(workspace)))return null;
 const data=shop.legacyWorkspaceId?workspace?.data:shop.commerce?.data;if(!data)return null;
 const state=normalizeState(data as unknown as State);
 const id=path.slice(path.lastIndexOf('/')+1),ownerId=shop.organization.ownerId;
 const product=path.startsWith('/api/media/products/');
 const referenced=product?state.products.some(item=>item.active&&item.imageUrl===path):[state.shop.logoUrl,state.shop.bannerUrl].includes(path);
 if(!referenced)return null;
 const where={id,workspace:{ownerId}};
 const select=mediaReadSelect();
 const media=product?await prisma.productMedia.findFirst({where,select}):await prisma.shopMedia.findFirst({where,select});
 if(!media)return null;
 return new Response(new Uint8Array(await readMediaContent(product?'product':'brand',media)),{headers:{'Content-Type':media.mimeType,'Content-Length':String(media.size),'X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Cache-Control':'no-store'}});
}
