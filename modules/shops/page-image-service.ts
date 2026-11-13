import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {isPublicIsolatedShop} from './publication';
import {isOpen} from '../platform/public';
import {pageContent,pagePhotoIds,type PageContent} from './page-content';
import {readMediaContent,mediaReadSelect} from '../media/content-store';
export async function assertPagePhotoOwnership(tx:Prisma.TransactionClient,ownerId:string,content:PageContent){
 const ids=pagePhotoIds(content);if(!ids.length)return;
 if(await tx.productMedia.count({where:{id:{in:ids},workspace:{ownerId}}})!==ids.length)throw new HttpError(403,'Une photo ne t’appartient pas ou a été supprimée. Choisis une photo de ta médiathèque.');
}
export async function readPublicPageImage(slug:string,pageSlug:string,id:string){
 const shop=await prisma.shop.findUnique({where:{slug},select:{status:true,legacyWorkspaceId:true,commerce:{select:{shopId:true}},
  legacyWorkspace:{select:{ownerId:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true}},
  organization:{select:{ownerId:true,owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}},
  pages:{where:{slug:pageSlug,publishedAt:{not:null}},select:{published:true},take:1}
 }});
 if(!shop?.pages[0])return null;
 const subscription=shop.organization.owner.workspace;
 const open=shop.legacyWorkspaceId?!!shop.legacyWorkspace&&shop.legacyWorkspace.ownerId===shop.organization.ownerId&&isOpen(shop.legacyWorkspace):isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,subscriptionStatus:subscription?.subscriptionStatus||'',subscriptionEndsAt:subscription?.subscriptionEndsAt||null});
 if(!open)return null;
 const content=pageContent.safeParse(shop.pages[0].published);
 if(!content.success||!pagePhotoIds(content.data).includes(id))return null;
 const row=await prisma.productMedia.findFirst({where:{id,workspace:{ownerId:shop.organization.ownerId}},select:mediaReadSelect()});
 return row?{content:await readMediaContent('product',row),mimeType:row.mimeType,size:row.size}:null;
}
