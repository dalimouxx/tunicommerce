import {prisma} from '../storage/client';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';

/** Called only after public-host authorization; sessions never grant access to another asset. */
export async function storefrontDomainMedia(slug:string,path:string){
 const shop=await prisma.shop.findUnique({where:{slug},select:{commerce:{select:{data:true}},organization:{select:{ownerId:true}}}});
 if(!shop?.commerce)return null;
 const state=normalizeState(shop.commerce.data as unknown as State);
 const id=path.slice(path.lastIndexOf('/')+1),ownerId=shop.organization.ownerId;
 const product=path.startsWith('/api/media/products/');
 const referenced=product?state.products.some(item=>item.imageUrl===path):[state.shop.logoUrl,state.shop.bannerUrl].includes(path);
 if(!referenced)return null;
 const where={id,workspace:{ownerId}};
 const select={content:true,mimeType:true,size:true};
 const media=product?await prisma.productMedia.findFirst({where,select}):await prisma.shopMedia.findFirst({where,select});
 if(!media)return null;
 return new Response(new Uint8Array(media.content),{headers:{'Content-Type':media.mimeType,'Content-Length':String(media.size),'X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Cache-Control':'no-store'}});
}
