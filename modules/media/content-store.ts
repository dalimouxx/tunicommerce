import {prisma} from '../storage/client';
import {mediaMirrorEnabled,writeMediaObject,readMediaObject} from './file-store';

export type MediaKind='product'|'brand';
export const mediaMetadataSelect={id:true,workspaceId:true,mimeType:true,size:true,storageKey:true,contentSha256:true} as const;
/** In database mode retain the original single-query read path. */
export function mediaReadSelect(){return {...mediaMetadataSelect,...(!mediaMirrorEnabled()?{content:true as const}:{})};}
type MediaRow={id:string;workspaceId:string;mimeType:string;size:number;storageKey:string|null;contentSha256:string|null;content?:Uint8Array};
export async function prepareMediaContent(workspaceId:string,bytes:Uint8Array){
 const content=new Uint8Array(bytes);
 if(mediaMirrorEnabled())try{return {content,...await writeMediaObject(workspaceId,content)};}
 catch{console.warn('Copie média différée ; original conservé en base.');}
 return {content,storageKey:null,contentSha256:null};
}
/** Called only after the existing owner/publication checks. No direct public file URL. */
export async function readMediaContent(kind:MediaKind,row:MediaRow,load=loadCanonicalContent){
 if(row.content)return row.content;
 if(mediaMirrorEnabled()&&row.storageKey&&row.contentSha256){
  try{return await readMediaObject(row.workspaceId,row.storageKey,row.contentSha256,row.size);}catch{/* PostgreSQL remains authoritative during transition. */}
 }
 return load(kind,row);
}
async function loadCanonicalContent(kind:MediaKind,row:MediaRow){
 const where={id:row.id,workspaceId:row.workspaceId,size:row.size,mimeType:row.mimeType,storageKey:row.storageKey,contentSha256:row.contentSha256};
 const current=kind==='product'?await prisma.productMedia.findFirst({where,select:{content:true}}):await prisma.shopMedia.findFirst({where,select:{content:true}});
 if(!current)throw Error('Media unavailable');return current.content;
}
