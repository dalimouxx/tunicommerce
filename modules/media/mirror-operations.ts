import {prisma} from '../storage/client';
import {mediaMetadataSelect,type MediaKind} from './content-store';
import {mediaMirrorEnabled,writeMediaObject,readMediaObject,mediaDigest} from './file-store';
import {z} from 'zod';

export const mirrorBatchInput=z.object({kind:z.enum(['product','brand']),action:z.enum(['copy','verify']),
 after:z.uuid().optional(),limit:z.number().int().min(1).max(25).default(25),workspaceId:z.uuid().optional()}).strict();
export async function mediaMirrorStatus(){
 const rows=await prisma.$queryRaw<{kind:string;total:bigint;copied:bigint;bytes:bigint}[]>`
  SELECT 'product' AS kind, count(*) AS total, count("storageKey") AS copied, coalesce(sum("size"),0)::bigint AS bytes FROM "ProductMedia"
  UNION ALL SELECT 'brand', count(*), count("storageKey"), coalesce(sum("size"),0)::bigint FROM "ShopMedia"`;
 return {mode:mediaMirrorEnabled()?'filesystem-mirror':'database',rootConfigured:!!process.env.MEDIA_STORAGE_ROOT,
  canonicalBytesRetained:true,media:rows.map(row=>({...row,total:row.total.toString(),copied:row.copied.toString(),bytes:row.bytes.toString()}))};
}
/** Copy only: never removes PostgreSQL bytes or rewrites storefront URLs. */
export async function mediaMirrorBatch(raw:z.input<typeof mirrorBatchInput>){
 const input=mirrorBatchInput.parse(raw);
 if(!mediaMirrorEnabled())throw Error('Filesystem mirror is disabled');
 const where={...(input.after?{id:{gt:input.after}}:{}),...(input.workspaceId?{workspaceId:input.workspaceId}:{})};
 const rows=input.kind==='product'?await prisma.productMedia.findMany({where,orderBy:{id:'asc'},take:input.limit,select:{id:true,workspaceId:true}}):
  await prisma.shopMedia.findMany({where,orderBy:{id:'asc'},take:input.limit,select:{id:true,workspaceId:true}});
 let ready=0,missing=0,unavailable=0,conflicts=0;
 for(const item of rows){
  try{
   const outcome=input.action==='copy'?await copyOne(input.kind,item):await verifyOne(input.kind,item);
   if(outcome==='ready')ready++;else if(outcome==='missing')missing++;else conflicts++;
  }catch{unavailable++;}
 }
 return {kind:input.kind,action:input.action,scanned:rows.length,ready,missing,unavailable,conflicts,
  canonicalBytesRetained:true,nextCursor:rows.length===input.limit?rows.at(-1)!.id:null};
}
async function copyOne(kind:MediaKind,item:{id:string;workspaceId:string}){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id"=${item.workspaceId} FOR UPDATE`;
  const select={...mediaMetadataSelect,content:true},where={id:item.id,workspaceId:item.workspaceId};
  const row=kind==='product'?await tx.productMedia.findFirst({where,select}):await tx.shopMedia.findFirst({where,select});
  if(!row)return 'conflict';
  if(row.content.byteLength!==row.size)throw Error('Canonical media size mismatch');
  const data=await writeMediaObject(row.workspaceId,row.content);
  const match={...where,content:{equals:row.content},size:row.size};
  const result=kind==='product'?await tx.productMedia.updateMany({where:match,data}):await tx.shopMedia.updateMany({where:match,data});
  return result.count===1?'ready':'conflict';
 },{timeout:12000});
}
async function verifyOne(kind:MediaKind,item:{id:string;workspaceId:string}){
 const select={...mediaMetadataSelect,content:true},where={id:item.id,workspaceId:item.workspaceId};
 const row=kind==='product'?await prisma.productMedia.findFirst({where,select}):await prisma.shopMedia.findFirst({where,select});
 if(!row)return 'conflict';if(!row.storageKey||!row.contentSha256)return 'missing';
 if(row.content.byteLength!==row.size||mediaDigest(row.content)!==row.contentSha256)throw Error('Canonical media mismatch');
 await readMediaObject(row.workspaceId,row.storageKey,row.contentSha256,row.size);return 'ready';
}
