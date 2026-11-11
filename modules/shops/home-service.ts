import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {isOpen} from '../platform/public';
import {isPublicIsolatedShop} from './publication';
import {homeContent,initialHomeContent,changeHomeInput,type HomeEditorRecord} from './home-content';
import type {z} from 'zod';
import {assertHomePhotoOwnership} from './home-image-service';
import {randomUUID} from 'node:crypto';
import {readHomeHistory,appendHomeHistory,summarizeHomeRevision,type HomeRevision} from './home-history';

/** Homepage ownership covers the existing workspace shop as well as independent shops. */
export async function homeOwner(userId:string,shopId:string,tx:Prisma.TransactionClient=prisma){
 const member=await tx.membership.findUnique({where:{shopId_userId:{shopId,userId}},select:{active:true,role:true,shop:{select:{id:true,name:true,slug:true,status:true,legacyWorkspaceId:true,
  commerce:{select:{shopId:true}},legacyWorkspace:{select:{ownerId:true,slug:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true}},
  organization:{select:{ownerId:true,owner:{select:{workspace:{select:{id:true,subscriptionStatus:true,subscriptionEndsAt:true}}}}}}
 }}}});
 if(!member?.active)throw new HttpError(404,'Boutique introuvable');
 const shop=member.shop;
 if(member.role!=='OWNER'||shop.organization.ownerId!==userId||shop.legacyWorkspaceId&&shop.legacyWorkspace?.ownerId!==userId)
  throw new HttpError(403,'Édition réservée au propriétaire de cette boutique');
 if(!shop.legacyWorkspaceId&&!shop.commerce)throw new HttpError(409,'Initialisez votre boutique');
 return shop;
}
export function homePublicPath(shop:Awaited<ReturnType<typeof homeOwner>>){
 if(shop.legacyWorkspaceId)return shop.legacyWorkspace?.slug&&isOpen(shop.legacyWorkspace)?'/boutiques/'+encodeURIComponent(shop.legacyWorkspace.slug):null;
 const subscription=shop.organization.owner.workspace;
 return isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,subscriptionStatus:subscription?.subscriptionStatus||'',subscriptionEndsAt:subscription?.subscriptionEndsAt||null})?'/vitrines/'+encodeURIComponent(shop.slug):null;
}

function editor(row:{draft:Prisma.JsonValue;published:Prisma.JsonValue;version:number;publishedAt:Date|null;publishedVersion:number|null}|null):HomeEditorRecord{
 if(!row)return {draft:initialHomeContent(),version:0,publishedAt:null,publishedVersion:null,hasUnpublishedChanges:false};
 const draft=homeContent.parse(row.draft),published=homeContent.safeParse(row.published);
 return {draft,version:row.version,publishedAt:row.publishedAt?.toISOString()||null,publishedVersion:row.publishedVersion,
  hasUnpublishedChanges:!row.publishedAt||!published.success||JSON.stringify(draft)!==JSON.stringify(published.data)};
}
export async function getShopHome(userId:string,shopId:string){
 await homeOwner(userId,shopId);
 return editor(await prisma.shopHome.findUnique({where:{shopId}}));
}
export async function getShopHomeHistory(userId:string,shopId:string,revisionId?:string){
 await homeOwner(userId,shopId);
 const row=await prisma.shopHome.findUnique({where:{shopId},select:{history:true}});
 const history=readHomeHistory(row?.history);
 if(!revisionId)return {revisions:history.toReversed().map(summarizeHomeRevision)};
 const revision=history.find(entry=>entry.id===revisionId);
 if(!revision)throw new HttpError(404,'Version introuvable ou sortie de l’historique.');
 return revision;
}
export async function changeShopHome(userId:string,shopId:string,input:z.infer<typeof changeHomeInput>){
 return prisma.$transaction(async tx=>{
  const candidate=await homeOwner(userId,shopId,tx);
  // Keep the workspace-before-shop lock order used by legacy commerce operations.
  const workspaceId=candidate.legacyWorkspaceId||candidate.organization.owner.workspace?.id;
  if(workspaceId)await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Shop" WHERE id=${shopId} FOR UPDATE`;
  const shop=await homeOwner(userId,shopId,tx);
  if(shop.legacyWorkspaceId!==candidate.legacyWorkspaceId)throw new HttpError(409,'La boutique a changé. Rechargez avant de réessayer.');
  const row=await tx.shopHome.findUnique({where:{shopId}});
  if((row?.version||0)!==input.version)throw new HttpError(409,'L’accueil a changé. Rechargez avant de réessayer.');
  if(!row&&input.action!=='save')throw new HttpError(409,'Enregistrez un brouillon avant de continuer.');
  let history=readHomeHistory(row?.history);
  const snapshot=(action:HomeRevision['action'],content:unknown,version:number,date=new Date())=>{
   history=appendHomeHistory(history,{id:randomUUID(),version,createdAt:date.toISOString(),action,content:homeContent.parse(content)});
  };
  // Lazily retain the two existing states on the first successful mutation after upgrade.
  if(row&&!history.length){
   if(row.publishedAt&&JSON.stringify(row.draft)!==JSON.stringify(row.published))snapshot('publishedCheckpoint',row.published,row.publishedVersion??row.version,row.publishedAt);
   snapshot('checkpoint',row.draft,row.version,row.updatedAt);
  }
  const historyData=()=>history as unknown as Prisma.InputJsonValue;
  if(input.action==='save'){
   await assertHomePhotoOwnership(tx,userId,input.content);
   snapshot('save',input.content,(row?.version||0)+1);
   return editor(await tx.shopHome.upsert({where:{shopId},create:{shopId,draft:input.content as Prisma.InputJsonValue,history:historyData(),version:1},update:{draft:input.content as Prisma.InputJsonValue,history:historyData(),version:{increment:1}}}));
  }
  if(input.action==='publish'){
   if(!homePublicPath(await homeOwner(userId,shopId,tx)))
    throw new HttpError(409,'Publiez la boutique avec un abonnement valide avant de publier son accueil.');
   await assertHomePhotoOwnership(tx,userId,homeContent.parse(row!.draft));
   snapshot('publish',row!.draft,row!.version+1);
   return editor(await tx.shopHome.update({where:{shopId},data:{published:homeContent.parse(row!.draft) as Prisma.InputJsonValue,publishedAt:new Date(),publishedVersion:row!.version,history:historyData(),version:{increment:1}}}));
  }
  if(input.action==='restoreRevision'){
   const revision=history.find(entry=>entry.id===input.revisionId);
   if(!revision)throw new HttpError(404,'Version introuvable ou sortie de l’historique.');
   await assertHomePhotoOwnership(tx,userId,revision.content);
   snapshot('restoreRevision',revision.content,row!.version+1);
   return editor(await tx.shopHome.update({where:{shopId},data:{draft:revision.content as Prisma.InputJsonValue,history:historyData(),version:{increment:1}}}));
  }
  if(input.action==='restore'){
   if(!row!.publishedAt)throw new HttpError(409,'Aucune version publiée à restaurer.');
   await assertHomePhotoOwnership(tx,userId,homeContent.parse(row!.published));
   snapshot('restore',row!.published,row!.version+1);
   return editor(await tx.shopHome.update({where:{shopId},data:{draft:homeContent.parse(row!.published) as Prisma.InputJsonValue,history:historyData(),version:{increment:1}}}));
  }
  snapshot('unpublish',row!.draft,row!.version+1);
  return editor(await tx.shopHome.update({where:{shopId},data:{published:Prisma.DbNull,publishedAt:null,publishedVersion:null,history:historyData(),version:{increment:1}}}));
 });
}
/** Caller must already have authorized this public shop. Draft fields never leave this query. */
export async function publishedShopHome(shopId:string){
 const row=await prisma.shopHome.findUnique({where:{shopId},select:{published:true,publishedAt:true}});
 if(!row?.publishedAt)return initialHomeContent();
 const parsed=homeContent.safeParse(row.published);
 return parsed.success?parsed.data:initialHomeContent();
}

/** The workspace publication gate must be checked by the caller before reading this. */
export async function publishedWorkspaceHome(workspaceId:string,ownerId:string){
 const shop=await prisma.shop.findUnique({where:{legacyWorkspaceId:workspaceId},select:{organization:{select:{ownerId:true}},home:{select:{published:true,publishedAt:true}}}});
 if(shop?.organization.ownerId!==ownerId||!shop.home?.publishedAt)return null;
 const parsed=homeContent.safeParse(shop.home.published);return parsed.success?parsed.data:null;
}
