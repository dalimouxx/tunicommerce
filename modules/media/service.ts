import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {normalizeState} from '../commerce/normalize';
import {isOpen} from '../platform/public';
import type {State} from '../commerce/types';
import type {MediaSlot} from './validation';
import {getInternalMediaId} from './validation';

export const mediaUrl=(id:string)=>'/api/media/assets/'+id;

/** Only one logo and one banner per Workspace. Updates never change the image ID. */
export async function saveMerchantMedia(
 ownerId:string,slot:MediaSlot,
 bytes:Uint8Array,details:{mimeType:string,size:number,width:number,height:number}
){
 const storedBytes=new Uint8Array(bytes);
 return prisma.$transaction(async tx=>{
  const row=await tx.workspace.findUnique({
   where:{ownerId},select:{id:true,data:true,version:true}
  });
  if(!row)throw new HttpError(404,'Votre boutique est introuvable');

  const media=await tx.shopMedia.upsert({
   where:{workspaceId_slot:{workspaceId:row.id,slot}},
   create:{
    workspaceId:row.id,slot,content:storedBytes,
    mimeType:details.mimeType,size:details.size,width:details.width,height:details.height
   },
   update:{
    content:storedBytes,mimeType:details.mimeType,size:details.size,
    width:details.width,height:details.height
   },
   select:{id:true}
  });

  const state=normalizeState(row.data as unknown as State);
  const url=mediaUrl(media.id);
  const next={
   ...state,
   shop:{
    ...state.shop,
    [slot==='logo'?'logoUrl':'bannerUrl']:url
   }
  };
  const result=await tx.workspace.updateMany({
   where:{id:row.id,version:row.version},
   data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}
  });
  if(result.count!==1)
   throw new HttpError(409,'Votre boutique a changé. Actualisez avant de réessayer.');
  return {url,width:details.width,height:details.height,size:details.size,slot};
 });
}

/** A merchant cannot insert the private asset ID of a different shop into their own theme. */
export async function verifyAppearanceMediaOwnership(
 tx:Prisma.TransactionClient,workspaceId:string,links:string[]
){
 const ids=[...new Set(links.map(getInternalMediaId).filter((id):id is string=>!!id))];
 if(!ids.length)return;
 const count=await tx.shopMedia.count({where:{id:{in:ids},workspaceId}});
 if(count!==ids.length)throw new HttpError(403,'Cette image ne vous appartient pas');
}

export async function getVisibleMedia(id:string,currentOwnerId:string|null){
 const media=await prisma.shopMedia.findUnique({
  where:{id},include:{workspace:{
   select:{ownerId:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true}
  }}
 });
 if(!media)return null;
 const publicAsset=isOpen(media.workspace);
 if(!publicAsset&&media.workspace.ownerId!==currentOwnerId)return null;
 return {
  content:media.content,
  mimeType:media.mimeType,
  size:media.size,
  publicAsset
 };
}
