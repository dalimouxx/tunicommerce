import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {pageOwner} from './page-service';
import {isPublicIsolatedShop} from './publication';
import {homeContent,initialHomeContent,changeHomeInput,type HomeEditorRecord} from './home-content';
import type {z} from 'zod';

function editor(row:{draft:Prisma.JsonValue;published:Prisma.JsonValue;version:number;publishedAt:Date|null;publishedVersion:number|null}|null):HomeEditorRecord{
 if(!row)return {draft:initialHomeContent(),version:0,publishedAt:null,publishedVersion:null,hasUnpublishedChanges:false};
 const draft=homeContent.parse(row.draft),published=homeContent.safeParse(row.published);
 return {draft,version:row.version,publishedAt:row.publishedAt?.toISOString()||null,publishedVersion:row.publishedVersion,
  hasUnpublishedChanges:!row.publishedAt||!published.success||JSON.stringify(draft)!==JSON.stringify(published.data)};
}
export async function getShopHome(userId:string,shopId:string){
 await pageOwner(userId,shopId);
 return editor(await prisma.shopHome.findUnique({where:{shopId}}));
}
export async function changeShopHome(userId:string,shopId:string,input:z.infer<typeof changeHomeInput>){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Shop" WHERE id=${shopId} FOR UPDATE`;
  const shop=await pageOwner(userId,shopId,tx);
  const row=await tx.shopHome.findUnique({where:{shopId}});
  if((row?.version||0)!==input.version)throw new HttpError(409,'L’accueil a changé. Rechargez avant de réessayer.');
  if(!row&&input.action!=='save')throw new HttpError(409,'Enregistrez un brouillon avant de continuer.');
  if(input.action==='save'){
   return editor(await tx.shopHome.upsert({where:{shopId},create:{shopId,draft:input.content as Prisma.InputJsonValue,version:1},update:{draft:input.content as Prisma.InputJsonValue,version:{increment:1}}}));
  }
  if(input.action==='publish'){
   const subscription=shop.organization.owner.workspace;
   if(!isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,subscriptionStatus:subscription?.subscriptionStatus||'',subscriptionEndsAt:subscription?.subscriptionEndsAt||null}))
    throw new HttpError(409,'Publiez la boutique avec un abonnement valide avant de publier son accueil.');
   return editor(await tx.shopHome.update({where:{shopId},data:{published:homeContent.parse(row!.draft) as Prisma.InputJsonValue,publishedAt:new Date(),publishedVersion:row!.version,version:{increment:1}}}));
  }
  if(input.action==='restore'){
   if(!row!.publishedAt)throw new HttpError(409,'Aucune version publiée à restaurer.');
   return editor(await tx.shopHome.update({where:{shopId},data:{draft:homeContent.parse(row!.published) as Prisma.InputJsonValue,version:{increment:1}}}));
  }
  return editor(await tx.shopHome.update({where:{shopId},data:{published:Prisma.DbNull,publishedAt:null,publishedVersion:null,version:{increment:1}}}));
 });
}
/** Caller must already have authorized this public shop. Draft fields never leave this query. */
export async function publishedShopHome(shopId:string){
 const row=await prisma.shopHome.findUnique({where:{shopId},select:{published:true,publishedAt:true}});
 if(!row?.publishedAt)return initialHomeContent();
 const parsed=homeContent.safeParse(row.published);
 return parsed.success?parsed.data:initialHomeContent();
}
