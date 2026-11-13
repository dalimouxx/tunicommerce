import {opendir,lstat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../storage/client';
import {mediaMaintenanceDirectory,mediaMirrorEnabled} from './file-store';

export const MEDIA_ORPHAN_RETENTION_DAYS=7;
const maximumFiles=25,maximumEntries=512;
const recognized=/^(?:[a-f0-9]{64}|\.pending-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;
export const mediaCleanupInput=z.object({workspaceId:z.uuid().optional(),after:z.uuid().optional(),apply:z.boolean().default(false),limit:z.number().int().min(1).max(10).default(10)}).strict()
 .refine(value=>!value.workspaceId||!value.after,'Un compte ciblé ne peut pas être combiné à un curseur');
const empty=()=>({workspaces:0,scanned:0,eligible:0,deleted:0,kept:0,unrecognized:0,changed:0,unavailable:0,blocked:0});
type Totals=ReturnType<typeof empty>;
function combine(total:Totals,row:Totals){for(const key of Object.keys(total) as (keyof Totals)[])total[key]+=row[key];}
async function canonicalBytesRequired(tx:Prisma.TransactionClient){
 const rows=await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('ProductMedia','ShopMedia')
  AND a.attname='content' AND a.attnotnull AND NOT a.attisdropped`;
 if(rows[0]?.count!==BigInt(2))throw Error('Canonical media storage must remain mandatory before cleanup');
}
/** Caller holds the workspace lock shared by uploads, replacements and copy migration. */
async function cleanupWorkspace(tx:Prisma.TransactionClient,workspaceId:string,apply:boolean,now:Date){
 const result=empty();result.workspaces=1;
 await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id"=${workspaceId} FOR UPDATE`;
 const directory=await mediaMaintenanceDirectory(workspaceId);if(!directory)return result;
 const entries=[];const iterator=await opendir(directory);
 for await(const entry of iterator){entries.push(entry);if(entries.length>maximumEntries){result.blocked=1;return result;}}
 const cutoff=now.getTime()-MEDIA_ORPHAN_RETENTION_DAYS*86400000;
 const candidates=[];
 for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
  result.scanned++;
  if(!recognized.test(entry.name)||entry.isSymbolicLink()||!entry.isFile()){result.unrecognized++;continue;}
  try{
   const info=await lstat(join(directory,entry.name));
   if(info.isSymbolicLink()||!info.isFile()){result.unrecognized++;continue;}
   if(Math.max(info.mtimeMs,info.ctimeMs)>cutoff){result.kept++;continue;}
   candidates.push({name:entry.name,info,key:'v1/'+workspaceId+'/'+entry.name});
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')result.changed++;else result.unavailable++;}
 }
 const keys=candidates.filter(item=>!item.name.startsWith('.pending-')).map(item=>item.key);
 const references=keys.length?await tx.$queryRaw<{storageKey:string}[]>`
  SELECT DISTINCT "storageKey" FROM "ProductMedia" WHERE "workspaceId"=${workspaceId} AND "storageKey" IN (${Prisma.join(keys)})
  UNION SELECT DISTINCT "storageKey" FROM "ShopMedia" WHERE "workspaceId"=${workspaceId} AND "storageKey" IN (${Prisma.join(keys)})`:[];
 const live=new Set(references.map(item=>item.storageKey));
 for(const candidate of candidates){
  if(live.has(candidate.key)){result.kept++;continue;}
  if(result.eligible>=maximumFiles)continue;result.eligible++;
  if(!apply)continue;
  try{
   // Resolve the trusted directory again and reject replacement/touch since inspection.
   const currentDirectory=await mediaMaintenanceDirectory(workspaceId);if(currentDirectory!==directory){result.changed++;continue;}
   const path=join(directory,candidate.name),current=await lstat(path),previous=candidate.info;
   if(!current.isFile()||current.isSymbolicLink()||current.ino!==previous.ino||current.dev!==previous.dev||current.size!==previous.size||
    current.mtimeMs!==previous.mtimeMs||current.ctimeMs!==previous.ctimeMs||Math.max(current.mtimeMs,current.ctimeMs)>cutoff){result.changed++;continue;}
   await unlink(path);result.deleted++;
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')result.changed++;else result.unavailable++;}
 }
 return result;
}
async function batch(tx:Prisma.TransactionClient,input:z.output<typeof mediaCleanupInput>,now:Date){
 await canonicalBytesRequired(tx);
 const rows=await tx.workspace.findMany({where:input.workspaceId?{id:input.workspaceId}:input.after?{id:{gt:input.after}}:{},orderBy:{id:'asc'},take:input.workspaceId?1:input.limit,select:{id:true}});
 const total=empty();
 for(const row of rows)try{combine(total,await cleanupWorkspace(tx,row.id,input.apply,now));}catch{total.workspaces++;total.unavailable++;}
 return {...total,apply:input.apply,retentionDays:MEDIA_ORPHAN_RETENTION_DAYS,
  nextCursor:!input.workspaceId&&rows.length===input.limit?rows.at(-1)!.id:null};
}
export async function cleanupMediaCopies(raw:z.input<typeof mediaCleanupInput>,now=new Date()){
 const input=mediaCleanupInput.parse(raw);if(!mediaMirrorEnabled())throw Error('Media mirror is disabled');
 return prisma.$transaction(tx=>batch(tx,input,now),{timeout:30000});
}
/** Optional timer entry point: one bounded pass with a durable cursor; never enabled implicitly. */
export async function scheduleMediaCleanup(now=new Date()){
 if(process.env.MEDIA_GC_ENABLED!=='true'||!mediaMirrorEnabled())return {enabled:false as const,busy:false as const};
 return prisma.$transaction(async tx=>{
  const [lock]=await tx.$queryRaw<{locked:boolean}[]>`SELECT pg_try_advisory_xact_lock(hashtext('tunicom-media-gc')) AS locked`;
  if(!lock?.locked)return {enabled:true as const,busy:true as const};
  const progress=await tx.maintenanceProgress.upsert({where:{id:'media-gc'},create:{id:'media-gc'},update:{}});
  const result=await batch(tx,{after:progress.cursor??undefined,apply:true,limit:10},now);
  const cycleError=result.unavailable||result.blocked?'STORAGE_UNAVAILABLE':progress.cursor?progress.lastError:null;
  await tx.maintenanceProgress.update({where:{id:'media-gc'},data:{cursor:result.nextCursor,lastRunAt:now,
   ...(result.nextCursor===null&&!cycleError?{lastCompletedAt:now}:{}),lastScanned:result.scanned,lastDeleted:result.deleted,
   lastError:cycleError,version:{increment:1}}});
  return {enabled:true as const,busy:false as const,...result};
 },{timeout:30000});
}
