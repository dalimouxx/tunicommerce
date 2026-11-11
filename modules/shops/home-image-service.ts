import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {isOpen} from '../platform/public';
import {isPublicIsolatedShop} from './publication';
import {homeContent,homePhotoIds,type HomeContent} from './home-content';

export async function assertHomePhotoOwnership(tx:Prisma.TransactionClient,ownerId:string,content:HomeContent){
 const ids=homePhotoIds(content);if(!ids.length)return;
 if(await tx.productMedia.count({where:{id:{in:ids},workspace:{ownerId}}})!==ids.length)throw new HttpError(403,'Une photo ne t’appartient pas ou a été supprimée. Choisis une photo de ta médiathèque.');
}
export async function readPublicHomeImage(slug:string,id:string){
 const shop=await prisma.shop.findUnique({where:{slug},select:{status:true,legacyWorkspaceId:true,commerce:{select:{shopId:true}},
  legacyWorkspace:{select:{ownerId:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true}},
  organization:{select:{ownerId:true,owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}},
  home:{select:{published:true,publishedAt:true}}
 }});
 if(!shop?.home?.publishedAt)return null;
 const ownerId=shop.organization.ownerId,subscription=shop.organization.owner.workspace;
 const open=shop.legacyWorkspaceId?!!shop.legacyWorkspace&&shop.legacyWorkspace.ownerId===ownerId&&isOpen(shop.legacyWorkspace):
  isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,subscriptionStatus:subscription?.subscriptionStatus||'',subscriptionEndsAt:subscription?.subscriptionEndsAt||null});
 if(!open)return null;
 const content=homeContent.safeParse(shop.home.published);if(!content.success||!homePhotoIds(content.data).includes(id))return null;
 return prisma.productMedia.findFirst({where:{id,workspace:{ownerId}},select:{content:true,mimeType:true,size:true}});
}
