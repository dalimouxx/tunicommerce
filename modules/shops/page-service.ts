import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {isPublicIsolatedShop} from './publication';
import {pageContent,createPageInput,changePageInput,type PageContent,type PageEditorRecord} from './page-content';
import type {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {readPageHistory,appendPageHistory,summarizePageRevision,type PageRevision} from './page-history';

export async function pageOwner(userId:string,shopId:string,tx:Prisma.TransactionClient=prisma){
 const member=await tx.membership.findUnique({where:{shopId_userId:{shopId,userId}},select:{active:true,role:true,
  shop:{select:{id:true,name:true,slug:true,status:true,legacyWorkspaceId:true,commerce:{select:{shopId:true}},
   organization:{select:{ownerId:true,owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}}}}}});
 if(!member?.active)throw new HttpError(404,'Boutique introuvable');
 if(member.role!=='OWNER'||member.shop.organization.ownerId!==userId||member.shop.legacyWorkspaceId)
  throw new HttpError(403,'Édition réservée au propriétaire d’une boutique indépendante');
 if(!member.shop.commerce)throw new HttpError(409,'Initialisez votre boutique');
 return member.shop;
}
function record(row:{id:string;slug:string;draft:Prisma.JsonValue;version:number;publishedAt:Date|null}):PageEditorRecord{
 return {id:row.id,slug:row.slug,draft:pageContent.parse(row.draft),version:row.version,publishedAt:row.publishedAt?.toISOString()||null};
}
export async function listShopPages(userId:string,shopId:string){
 const shop=await pageOwner(userId,shopId);
 const rows=await prisma.shopPage.findMany({where:{shopId},select:{id:true,slug:true,draft:true,version:true,publishedAt:true},orderBy:[{createdAt:'asc'},{id:'asc'}]});
 return {shop:{name:shop.name,slug:shop.slug},pages:rows.map(record)};
}
export async function getShopPageHistory(userId:string,shopId:string,pageId:string,revisionId?:string){
 await pageOwner(userId,shopId);
 const row=await prisma.shopPage.findFirst({where:{id:pageId,shopId},select:{history:true}});
 if(!row)throw new HttpError(404,'Page introuvable');
 const history=readPageHistory(row.history);
 if(!revisionId)return {revisions:history.toReversed().map(summarizePageRevision)};
 const revision=history.find(entry=>entry.id===revisionId);
 if(!revision)throw new HttpError(404,'Version introuvable ou sortie de l’historique.');
 return revision;
}
async function lockShop(tx:Prisma.TransactionClient,shopId:string){
 await tx.$queryRaw`SELECT id FROM "Shop" WHERE id=${shopId} FOR UPDATE`;
}
export async function createShopPage(userId:string,shopId:string,input:z.infer<typeof createPageInput>){
 return prisma.$transaction(async tx=>{
  await lockShop(tx,shopId);await pageOwner(userId,shopId,tx);
  if(await tx.shopPage.count({where:{shopId}})>=10)throw new HttpError(409,'Limite de 10 pages par boutique atteinte');
  if(await tx.shopPage.findUnique({where:{shopId_slug:{shopId,slug:input.slug}}}))throw new HttpError(409,'Cette adresse de page existe déjà');
  const history:PageRevision[]=[{id:randomUUID(),version:0,createdAt:new Date().toISOString(),action:'create',content:input.content}];
  return record(await tx.shopPage.create({data:{shopId,slug:input.slug,draft:input.content as Prisma.InputJsonValue,history:history as unknown as Prisma.InputJsonValue}}));
 });
}
export async function changeShopPage(userId:string,shopId:string,pageId:string,input:z.infer<typeof changePageInput>){
 return prisma.$transaction(async tx=>{
  await lockShop(tx,shopId);const shop=await pageOwner(userId,shopId,tx);
  const row=await tx.shopPage.findFirst({where:{id:pageId,shopId}});
  if(!row)throw new HttpError(404,'Page introuvable');
  if(row.version!==input.version)throw new HttpError(409,'La page a changé. Rechargez avant de réessayer.');
  let history=readPageHistory(row.history);
  const snapshot=(action:PageRevision['action'],content:unknown,version:number|null,date=new Date())=>{
   history=appendPageHistory(history,{id:randomUUID(),version,createdAt:date.toISOString(),action,content:pageContent.parse(content)});
  };
  if(!history.length){
   // Older pages have no published version number; do not invent one.
   if(row.publishedAt&&JSON.stringify(row.draft)!==JSON.stringify(row.published))snapshot('publishedCheckpoint',row.published,null,row.publishedAt);
   snapshot('checkpoint',row.draft,row.version,row.updatedAt);
  }
  let data:Prisma.ShopPageUpdateInput={version:{increment:1}};
  if(input.action==='save'){data={...data,draft:input.content as Prisma.InputJsonValue};snapshot('save',input.content,row.version+1);}
  else if(input.action==='unpublish'){data={...data,published:Prisma.DbNull,publishedAt:null};snapshot('unpublish',row.draft,row.version+1);}
  else if(input.action==='restoreRevision'){
   const revision=history.find(entry=>entry.id===input.revisionId);
   if(!revision)throw new HttpError(404,'Version introuvable ou sortie de l’historique.');
   data={...data,draft:revision.content as Prisma.InputJsonValue};snapshot('restoreRevision',revision.content,row.version+1);
  }
  else{
   const subscription=shop.organization.owner.workspace;
   if(!isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,
    subscriptionStatus:subscription?.subscriptionStatus||'',subscriptionEndsAt:subscription?.subscriptionEndsAt||null}))
    throw new HttpError(409,'Publiez la boutique avec un abonnement valide avant de publier une page');
   data={...data,published:pageContent.parse(row.draft) as Prisma.InputJsonValue,publishedAt:new Date()};
   snapshot('publish',row.draft,row.version+1);
  }
  data.history=history as unknown as Prisma.InputJsonValue;
  return record(await tx.shopPage.update({where:{id:row.id},data}));
 });
}
export async function deleteShopPage(userId:string,shopId:string,pageId:string,version:number){
 await prisma.$transaction(async tx=>{
  await lockShop(tx,shopId);await pageOwner(userId,shopId,tx);
  const row=await tx.shopPage.findFirst({where:{id:pageId,shopId}});
  if(!row)throw new HttpError(404,'Page introuvable');
  if(row.version!==version)throw new HttpError(409,'La page a changé. Rechargez avant de réessayer.');
  await tx.shopPage.delete({where:{id:row.id}});
 });
}
export async function readPublicShopPage(slug:string,pageSlug:string){
 const shop=await prisma.shop.findUnique({where:{slug},select:{id:true,name:true,status:true,legacyWorkspaceId:true,commerce:{select:{shopId:true}},
  organization:{select:{owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}}}});
 const subscription=shop?.organization.owner.workspace;
 if(!shop||!isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,
  subscriptionStatus:subscription?.subscriptionStatus||'',subscriptionEndsAt:subscription?.subscriptionEndsAt||null}))return null;
 const row=await prisma.shopPage.findUnique({where:{shopId_slug:{shopId:shop.id,slug:pageSlug}},select:{published:true,publishedAt:true}});
 if(!row?.publishedAt)return null;
 const content=pageContent.safeParse(row.published);
 return content.success?{shopName:shop.name,content:content.data}:null;
}
export async function publishedPageLinks(shopId:string){
 const rows=await prisma.shopPage.findMany({where:{shopId,publishedAt:{not:null}},select:{slug:true,published:true},orderBy:[{createdAt:'asc'},{id:'asc'}],take:10});
 return rows.flatMap(row=>{const content=pageContent.safeParse(row.published);return content.success?[{slug:row.slug,title:content.data.title}]:[];});
}
