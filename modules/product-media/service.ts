import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {normalizeState} from '../commerce/normalize';
import {isOpen} from '../platform/public';
import type {State} from '../commerce/types';
import {LIBRARY_LIMIT,productPhotoUrl} from './validation';
import {loadWorkspaceQuotas} from '../subscriptions/quotas';
import {homeContent,homePhotoIds} from '../shops/home-content';
import {readHomeHistory} from '../shops/home-history';
import {pageContent,pagePhotoIds} from '../shops/page-content';
import {readPageHistory} from '../shops/page-history';

export async function listProductPhotos(ownerId:string){
 const shop=await prisma.workspace.findUnique({where:{ownerId},select:{id:true,plan:true}});
 if(!shop)throw new HttpError(404,'Boutique introuvable');
 const {maxPhotos}=await loadWorkspaceQuotas(shop);
 const rows=await prisma.productMedia.findMany({
  where:{workspaceId:shop.id},
  orderBy:{createdAt:'desc'},
  select:{id:true,size:true,width:true,height:true,createdAt:true}
 });
 return {limit:maxPhotos,photos:rows.map(p=>({
  id:p.id,url:productPhotoUrl(p.id),size:p.size,width:p.width,height:p.height,
  createdAt:p.createdAt.toISOString()
 }))};
}

export async function uploadProductPhoto(
 ownerId:string,bytes:Uint8Array,info:{mimeType:string;size:number;width:number;height:number}
){
 const copy=new Uint8Array(bytes);
 return prisma.$transaction(async tx=>{
  const workspace=await tx.workspace.findUnique({where:{ownerId},select:{id:true,plan:true}});
  if(!workspace)throw new HttpError(404,'Boutique introuvable');
  // Serialize uploads for a workspace; concurrent requests may not evade quota.
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspace.id} FOR UPDATE`;
  const {maxPhotos}=await loadWorkspaceQuotas(workspace,tx);
  const count=await tx.productMedia.count({where:{workspaceId:workspace.id}});
  if(count>=maxPhotos)throw new HttpError(409,`Quota de photos atteint (${maxPhotos}). Supprimez une image inutilisée ou changez de formule.`);
  const saved=await tx.productMedia.create({
   data:{workspaceId:workspace.id,content:copy,...info},
   select:{id:true,size:true,width:true,height:true,createdAt:true}
  });
  return {
   id:saved.id,url:productPhotoUrl(saved.id),
   size:saved.size,width:saved.width,height:saved.height,
   createdAt:saved.createdAt.toISOString()
  };
 });
}

export async function ownsProductPhoto(ownerId:string,id:string){
 const media=await prisma.productMedia.findFirst({where:{id,workspace:{ownerId}},select:{id:true}});
 return !!media;
}

export async function removeProductPhoto(ownerId:string,id:string){
 return prisma.$transaction(async tx=>{
  const row=await tx.workspace.findUnique({where:{ownerId},select:{id:true}});
  if(!row)throw new HttpError(404,'Boutique introuvable');
  // Lock, then reread current JSON. A concurrent product save must not race deletion.
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${row.id} FOR UPDATE`;
  const [photo,current]=await Promise.all([
   tx.productMedia.findFirst({where:{id,workspaceId:row.id},select:{id:true}}),
   tx.workspace.findUniqueOrThrow({where:{id:row.id},select:{data:true}})
  ]);
  if(!photo)throw new HttpError(404,'Photo introuvable');
  const state=normalizeState(current.data as unknown as State);
  const url=productPhotoUrl(id);
  if(state.products.some(p=>p.imageUrl===url))
   throw new HttpError(409,'Cette image est utilisée par un produit. Changez sa photo avant de la supprimer.');
  const homes=await tx.shopHome.findMany({where:{shop:{organization:{ownerId}}},select:{draft:true,published:true,history:true}});
  if(homes.some(home=>[home.draft,home.published,...readHomeHistory(home.history).map(entry=>entry.content)].some(value=>{const parsed=homeContent.safeParse(value);return parsed.success&&homePhotoIds(parsed.data).includes(id);})))
   throw new HttpError(409,'Cette photo est conservée par un accueil ou son historique. Elle sera supprimable quand elle ne figurera plus dans le brouillon, la publication ni les 20 dernières étapes.');
  const pages=await tx.shopPage.findMany({where:{shop:{organization:{ownerId}}},select:{draft:true,published:true,history:true}});
  if(pages.some(page=>[page.draft,page.published,...readPageHistory(page.history).map(entry=>entry.content)].some(value=>{const parsed=pageContent.safeParse(value);return parsed.success&&pagePhotoIds(parsed.data).includes(id);})))
   throw new HttpError(409,'Cette photo est conservée par une page ou son historique. Elle sera supprimable quand elle ne figurera plus dans le brouillon, la publication ni les 20 dernières étapes.');
  await tx.productMedia.delete({where:{id}});
  // Invalidates a racing commerce optimistic write that still references this image.
  await tx.workspace.update({where:{id:row.id},data:{version:{increment:1}}});
  return {ok:true};
 });
}

export async function getVisibleProductPhoto(id:string,viewerId:string|null){
 const row=await prisma.productMedia.findUnique({
  where:{id},include:{workspace:{
   select:{ownerId:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true}
  }}
 });
 if(!row)return null;
 const publicAsset=isOpen(row.workspace);
 if(!publicAsset&&row.workspace.ownerId!==viewerId)return null;
 return {
  content:row.content,mimeType:row.mimeType,size:row.size,publicAsset
 };
}
