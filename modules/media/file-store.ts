import {createHash,randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,realpath,mkdir,open,link,unlink,readdir,statfs} from 'node:fs/promises';
import {isAbsolute,join,resolve,relative,sep} from 'node:path';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha=/^[0-9a-f]{64}$/;
export const MEDIA_MAX_BYTES=2*1024*1024;
const MAX_FILES=512,MAX_WORKSPACE_BYTES=64*1024*1024,MIN_FREE_BYTES=256*1024*1024;
export const mediaDigest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export function mediaMirrorEnabled(env:Record<string,string|undefined>=process.env){return env.MEDIA_STORAGE_MODE==='filesystem-mirror';}
export function mediaObjectKey(workspaceId:string,digest:string){
 if(!uuid.test(workspaceId)||!sha.test(digest))throw Error('Invalid media identity');
 return 'v1/'+workspaceId+'/'+digest;
}
async function directory(path:string){
 const info=await lstat(path);
 if(!info.isDirectory()||info.isSymbolicLink()||process.platform!=='win32'&&(info.mode&0o077)!==0)throw Error('Unsafe media directory');
}
async function root(){
 const value=process.env.MEDIA_STORAGE_ROOT;
 if(!value||!isAbsolute(value))throw Error('Media root missing');
 const path=resolve(value),local=relative(process.cwd(),path);
 if(local===''||!isAbsolute(local)&&local!=='..'&&!local.startsWith('..'+sep)){
  if(!local.startsWith('.test-runtime'+sep))throw Error('Media root must be outside application source');
 }
 await directory(path);
 // The operator provisions this directory; an absent mount must not create an ephemeral root.
 if(resolve(await realpath(path))!==path)throw Error('Media root must be canonical');
 return path;
}
async function objectPath(workspaceId:string,key:string,create=false){
 const parts=key.split('/');
 if(parts.length!==3||key!==mediaObjectKey(workspaceId,parts[2]))throw Error('Invalid media key');
 const base=await root();let path=base;
 for(const segment of parts.slice(0,2)){
  path=join(path,segment);
  if(create)try{await mkdir(path,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  await directory(path);
 }
 return {path:join(path,parts[2]),parent:path,base};
}
export async function readMediaObject(workspaceId:string,key:string,digest:string,size:number){
 if(!sha.test(digest)||key!==mediaObjectKey(workspaceId,digest)||!Number.isSafeInteger(size)||size<1||size>MEDIA_MAX_BYTES)throw Error('Invalid media metadata');
 const {path}=await objectPath(workspaceId,key),info=await lstat(path);
 if(!info.isFile()||info.isSymbolicLink()||info.size!==size||process.platform!=='win32'&&(info.mode&0o077)!==0)throw Error('Invalid media object');
 const handle=await open(path,constants.O_RDONLY|(process.platform==='win32'?0:constants.O_NOFOLLOW));
 try{
  const current=await handle.stat();if(!current.isFile()||current.size!==size)throw Error('Invalid media object');
  // Fixed allocation bounds reads even if another local process grows the file.
  const bytes=Buffer.alloc(size+1);let offset=0;
  while(offset<bytes.length){const result=await handle.read(bytes,offset,bytes.length-offset,offset);if(!result.bytesRead)break;offset+=result.bytesRead;}
  if(offset!==size||mediaDigest(bytes.subarray(0,size))!==digest)throw Error('Media integrity mismatch');
  return new Uint8Array(bytes.subarray(0,size));
 }finally{await handle.close();}
}
export async function writeMediaObject(workspaceId:string,input:Uint8Array){
 const bytes=new Uint8Array(input);if(!bytes.length||bytes.length>MEDIA_MAX_BYTES)throw Error('Invalid media size');
 const digest=mediaDigest(bytes),key=mediaObjectKey(workspaceId,digest),{path,parent,base}=await objectPath(workspaceId,key,true);
 try{await readMediaObject(workspaceId,key,digest,bytes.length);return {storageKey:key,contentSha256:digest};}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const capacity=await statfs(base,{bigint:true});if(capacity.bavail*capacity.bsize<BigInt(MIN_FREE_BYTES))throw Error('Media capacity limit');
 const entries=await readdir(parent,{withFileTypes:true});if(entries.length>=MAX_FILES)throw Error('Media capacity limit');
 let used=0;
 for(const entry of entries){if(!entry.isFile()||entry.isSymbolicLink())throw Error('Unsafe media directory');used+=(await lstat(join(parent,entry.name))).size;}
 if(used+bytes.length>MAX_WORKSPACE_BYTES)throw Error('Media capacity limit');
 const temporary=join(parent,'.pending-'+randomUUID()),handle=await open(temporary,'wx',0o600);
 try{
  await handle.writeFile(bytes);await handle.sync();await handle.close();
  try{await link(temporary,path);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  if(process.platform!=='win32'){const dir=await open(parent,constants.O_RDONLY|constants.O_DIRECTORY);try{await dir.sync();}finally{await dir.close();}}
  await readMediaObject(workspaceId,key,digest,bytes.length);
  return {storageKey:key,contentSha256:digest};
 }finally{await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});}
}
