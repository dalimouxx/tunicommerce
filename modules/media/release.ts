import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {prisma} from '../storage/client';
import {mediaMetadataSelect,type MediaKind} from './content-store';
import {mediaDigest,mediaReleaseEnabled,readMediaObject} from './file-store';

export const MEDIA_BACKUP_MAX_AGE_MS=30*3600_000;
export const releaseBatchInput=z.object({kind:z.enum(['product','brand']),action:z.enum(['release','restore']),
 after:z.uuid().optional(),limit:z.number().int().min(1).max(25).default(25),workspaceId:z.uuid().optional()}).strict();
export async function mediaReleaseBatch(raw:z.input<typeof releaseBatchInput>){
 const input=releaseBatchInput.parse(raw);
 return input.action==='release'?releaseMediaBatch(input.kind,input):restoreMediaBatch(input.kind,input);
}
/** The VPS backup writes {ok, at(seconds)} in the media root after archiving it; release trusts nothing older than 30 h. */
export function mediaBackupFresh(marker:{ok?:unknown;at?:unknown}|null,now=Date.now()){
 return !!marker&&marker.ok===true&&typeof marker.at==='number'&&Number.isFinite(marker.at)&&now-marker.at*1000<MEDIA_BACKUP_MAX_AGE_MS&&marker.at*1000<=now+60_000;
}
export async function readMediaBackupMarker(){
 const root=process.env.MEDIA_STORAGE_ROOT;if(!root)return null;
 try{return JSON.parse(await readFile(join(root,'.backup-status.json'),'utf8')) as {ok?:unknown;at?:unknown};}catch{return null;}
}
/** Clears PostgreSQL bytes only for rows whose filesystem copy matches byte-for-byte, after a fresh media backup. */
async function releaseMediaBatch(kind:MediaKind,input:{after?:string;limit:number;workspaceId?:string}){
 if(!mediaReleaseEnabled())throw Error('MEDIA_STORAGE_MODE=filesystem-primary requis');
 if(!mediaBackupFresh(await readMediaBackupMarker()))throw Error('Sauvegarde des photos absente ou de plus de 30 heures : libération refusée');
 const where={content:{not:null},storageKey:{not:null},...(input.after?{id:{gt:input.after}}:{}),...(input.workspaceId?{workspaceId:input.workspaceId}:{})};
 const rows=kind==='product'?await prisma.productMedia.findMany({where,orderBy:{id:'asc'},take:input.limit,select:{id:true,workspaceId:true}}):
  await prisma.shopMedia.findMany({where,orderBy:{id:'asc'},take:input.limit,select:{id:true,workspaceId:true}});
 let released=0,skipped=0;
 for(const item of rows){
  const done=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id"=${item.workspaceId} FOR UPDATE`;
   const select={...mediaMetadataSelect,content:true},key={id:item.id,workspaceId:item.workspaceId};
   const row=kind==='product'?await tx.productMedia.findFirst({where:key,select}):await tx.shopMedia.findFirst({where:key,select});
   if(!row?.content||!row.storageKey||!row.contentSha256||row.content.byteLength!==row.size||mediaDigest(row.content)!==row.contentSha256)return false;
   const disk=await readMediaObject(row.workspaceId,row.storageKey,row.contentSha256,row.size).catch(()=>null);
   if(!disk||Buffer.compare(Buffer.from(disk),Buffer.from(row.content))!==0)return false;
   const match={...key,content:{equals:row.content},storageKey:row.storageKey,contentSha256:row.contentSha256};
   const data={content:null,contentReleasedAt:new Date()};
   const result=kind==='product'?await tx.productMedia.updateMany({where:match,data}):await tx.shopMedia.updateMany({where:match,data});
   return result.count===1;
  },{timeout:12000}).catch(()=>false);
  if(done)released++;else skipped++;
 }
 return {kind,action:'release',scanned:rows.length,released,skipped,nextCursor:rows.length===input.limit?rows.at(-1)!.id:null};
}
/** Rollback: puts verified filesystem bytes back into PostgreSQL. */
async function restoreMediaBatch(kind:MediaKind,input:{after?:string;limit:number;workspaceId?:string}){
 const where={content:null,...(input.after?{id:{gt:input.after}}:{}),...(input.workspaceId?{workspaceId:input.workspaceId}:{})};
 const rows=kind==='product'?await prisma.productMedia.findMany({where,orderBy:{id:'asc'},take:input.limit,select:{...mediaMetadataSelect}}):
  await prisma.shopMedia.findMany({where,orderBy:{id:'asc'},take:input.limit,select:{...mediaMetadataSelect}});
 let restored=0,unavailable=0;
 for(const row of rows){
  try{
   const bytes=await readMediaObject(row.workspaceId,row.storageKey!,row.contentSha256!,row.size);
   const match={id:row.id,workspaceId:row.workspaceId,content:null,storageKey:row.storageKey};
   const data={content:Buffer.from(bytes)};
   const result=kind==='product'?await prisma.productMedia.updateMany({where:match,data}):await prisma.shopMedia.updateMany({where:match,data});
   if(result.count===1)restored++;else unavailable++;
  }catch{unavailable++;}
 }
 return {kind,action:'restore',scanned:rows.length,restored,unavailable,nextCursor:rows.length===input.limit?rows.at(-1)!.id:null};
}
