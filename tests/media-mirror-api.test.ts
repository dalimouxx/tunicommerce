import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,rm,writeFile,readFile,chmod,rename} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {initialState} from '../modules/commerce/seed';
import {portalSessionHash} from '../modules/auth/portal';
import {initialHomeContent} from '../modules/shops/home-content';
import {initialPageContent} from '../modules/shops/page-content';
import {stopTestServer} from './server-process';
const database=process.env.TEST_DATABASE_URL;
if(!database||database!==process.env.DATABASE_URL||!new URL(database).pathname.endsWith('_test'))throw Error('Matching disposable *_test databases required');
const {prisma}=await import('../modules/storage/client');
const {mediaMirrorBatch,mediaMirrorStatus}=await import('../modules/media/mirror-operations');
const {getVisibleProductPhoto}=await import('../modules/product-media/service');
const {mediaDigest,mediaObjectKey}=await import('../modules/media/file-store');
const {readMediaContent}=await import('../modules/media/content-store');
const parent=resolve('.test-runtime');await mkdir(parent,{recursive:true});
const root=await mkdtemp(join(parent,'media-api-'));await chmod(root,0o700);
process.env.MEDIA_STORAGE_MODE='filesystem-mirror';process.env.MEDIA_STORAGE_ROOT=root;
const origin='https://media-mirror.example.test',base='http://127.0.0.1:3212',mark=randomUUID().slice(0,8);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');
let server:ChildProcess|undefined,userId='',otherId='',workspaceId='',shopId='',cookie='',otherCookie='',photoId='',photoUrl='';
const get=(path:string,session='')=>fetch(base+path,{headers:{cookie:session},redirect:'manual'});
const upload=(path:string,session=cookie)=>fetch(base+path,{method:'PUT',headers:{origin,cookie:session,'content-type':'image/png'},body:new Blob([new Uint8Array(png)]),redirect:'manual'});
async function session(userId:string){const token=randomBytes(32).toString('hex');await prisma.session.create({data:{tokenHash:portalSessionHash(token,'MERCHANT'),userId,expiresAt:new Date(Date.now()+3600000)}});return '__Host-tunicommerce='+token;}
async function assertPhoto(path=photoUrl,session=cookie){const response=await get(path,session);assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array(png));assert.equal(response.headers.get('content-type'),'image/png');}

test('Media transition: private files, original URLs, authorization and canonical fallback',async t=>{
 try{
  const user=await prisma.user.create({data:{email:'mirror-'+mark+'@example.test',name:'Media fixture',passwordHash:'unused-fixture',workspace:{create:{data:initialState(false) as never,plan:'PRO',slug:'mirror-'+mark,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)}}},include:{workspace:true}});
  userId=user.id;workspaceId=user.workspace!.id;
  otherId=(await prisma.user.create({data:{email:'mirror-other-'+mark+'@example.test',name:'Other fixture',passwordHash:'unused-fixture'}})).id;
  cookie=await session(userId);otherCookie=await session(otherId);
  server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',APP_URL:origin,PORT:'3212'},stdio:'ignore'});
  let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('Server exited');try{if((await get('/api/health')).ok){ready=true;break;}}catch{}await pause(250);}assert.ok(ready);
  await t.test('Uploads preserve canonical bytes and original private access boundaries',async()=>{
   assert.equal((await upload('/api/v1/product-media','')).status,401);
   const response=await upload('/api/v1/product-media');assert.equal(response.status,201);const photo=await response.json();photoId=photo.id;photoUrl=photo.url;
   const row=await prisma.productMedia.findUniqueOrThrow({where:{id:photoId}});assert.ok(row.storageKey);assert.equal(row.contentSha256,mediaDigest(png));assert.deepEqual(new Uint8Array(row.content),new Uint8Array(png));
   assert.deepEqual(await readFile(join(root,row.storageKey!)),png);
   assert.equal((await get(photoUrl)).status,404);assert.equal((await get(photoUrl,otherCookie)).status,404);await assertPhoto();
   assert.equal('storageKey' in photo,false);assert.equal('contentSha256' in photo,false);
  });
  await t.test('Missing and corrupted copies fall back to the unchanged PostgreSQL original',async()=>{
   const row=await prisma.productMedia.findUniqueOrThrow({where:{id:photoId}});
   await writeFile(join(root,row.storageKey!),Buffer.alloc(png.length,1));await assertPhoto();
   const failed=await mediaMirrorBatch({kind:'product',action:'verify',workspaceId});assert.equal(failed.unavailable,1);
   await rm(join(root,row.storageKey!));await assertPhoto();
   assert.equal((await mediaMirrorBatch({kind:'product',action:'copy',workspaceId})).ready,1);
   assert.equal((await mediaMirrorBatch({kind:'product',action:'verify',workspaceId})).ready,1);
  });
  await t.test('Valid copies are read without loading canonical bytes; unsafe pointers are rejected by PostgreSQL',async()=>{
   const row=await prisma.productMedia.findUniqueOrThrow({where:{id:photoId}});
   const {content:_,...metadata}=row;
   const bytes=await readMediaContent('product',metadata,async()=>{throw Error('Canonical fallback must not run');});assert.deepEqual(bytes,new Uint8Array(png));
   await prisma.productMedia.update({where:{id:photoId},data:{storageKey:mediaObjectKey(randomUUID(),mediaDigest(png)),contentSha256:mediaDigest(png)}});
   assert.equal((await prisma.productMedia.findUniqueOrThrow({where:{id:photoId}})).storageKey,null);await assertPhoto();
   await mediaMirrorBatch({kind:'product',action:'copy',workspaceId});
   await prisma.productMedia.update({where:{id:photoId},data:{content:Buffer.alloc(png.length,2)}});
   assert.equal((await prisma.productMedia.findUniqueOrThrow({where:{id:photoId}})).storageKey,null);
   await prisma.productMedia.update({where:{id:photoId},data:{content:png}});await mediaMirrorBatch({kind:'product',action:'copy',workspaceId});
  });
  await t.test('Public images, homepage and page references use the same authorized media path',async()=>{
   await prisma.workspace.update({where:{id:workspaceId},data:{published:true}});await assertPhoto(photoUrl,'');
   const org=await prisma.organization.create({data:{ownerId:userId,name:'Media fixture group'}});
   shopId=(await prisma.shop.create({data:{organizationId:org.id,legacyWorkspaceId:workspaceId,name:'Media shop',slug:'mirror-shop-'+mark,status:'PUBLISHED'}})).id;
   const image={id:randomUUID(),type:'image' as const,title:'Fixture',imageUrl:photoUrl,alt:'Fictitious test image',caption:'',layout:'wide' as const,fit:'contain' as const};
   const home=initialHomeContent();home.fr.sections=[image];
   await prisma.shopHome.create({data:{shopId,draft:home,published:home,publishedAt:new Date()}});
   const page=initialPageContent();page.sections=[image];await prisma.shopPage.create({data:{shopId,slug:'fixture-page',draft:page,published:page,publishedAt:new Date()}});
   const prefix='/api/v1/public/vitrines/mirror-shop-'+mark;
   await assertPhoto(prefix+'/images/'+photoId,'');await assertPhoto(prefix+'/pages/fixture-page/images/'+photoId,'');
   await prisma.workspace.update({where:{id:workspaceId},data:{published:false}});
   assert.equal((await get(prefix+'/images/'+photoId,cookie)).status,404);assert.equal((await get(prefix+'/pages/fixture-page/images/'+photoId,cookie)).status,404);
   assert.equal(await getVisibleProductPhoto(photoId,otherId),null);
  });
  await t.test('Brand replacement remains atomic, keeps its URL and clears obsolete pointers',async()=>{
   const first=await upload('/api/v1/media/logo');assert.equal(first.status,201);const info=await first.json();
   const row=await prisma.shopMedia.findFirstOrThrow({where:{workspaceId,slot:'logo'}});assert.ok(row.storageKey);await assertPhoto(info.url);
   const results=await Promise.all([upload('/api/v1/media/logo'),upload('/api/v1/media/banner')]);assert.ok(results.every(r=>r.status===201));
   assert.equal((await prisma.shopMedia.findFirstOrThrow({where:{workspaceId,slot:'logo'}})).id,row.id);
   assert.equal((await mediaMirrorBatch({kind:'brand',action:'verify',workspaceId})).ready,2);
   assert.equal((await get(info.url,otherCookie)).status,404);
  });
  await t.test('Copy passes are bounded, idempotent and do not change commerce or publication',async()=>{
   await prisma.productMedia.createMany({data:Array.from({length:4},()=>({workspaceId,content:png,mimeType:'image/png',size:png.length,width:1,height:1}))});
   const before=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceId}});
   let after:string|undefined;let scanned=0;
   do{const result=await mediaMirrorBatch({kind:'product',action:'copy',workspaceId,limit:2,after});assert.ok(result.scanned<=2);scanned+=result.scanned;after=result.nextCursor??undefined;}while(after);
   assert.equal(scanned,5);assert.equal((await mediaMirrorBatch({kind:'product',action:'verify',workspaceId})).ready,5);
   const current=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceId}});assert.deepEqual(current.data,before.data);assert.equal(current.version,before.version);assert.equal(current.published,before.published);
   assert.equal((await mediaMirrorStatus()).canonicalBytesRetained,true);
  });
  await t.test('A missing persistent mount preserves uploads in PostgreSQL instead of creating a new root',async()=>{
   const offline=resolve(root+'-offline');
   for(const path of [root,offline]){const local=relative(parent,path);if(!local||isAbsolute(local)||local.startsWith('..'))throw Error('Unsafe fixture move');}
   await rename(root,offline);
   try{
    const response=await upload('/api/v1/product-media');assert.equal(response.status,201);const photo=await response.json();
    const row=await prisma.productMedia.findUniqueOrThrow({where:{id:photo.id}});assert.equal(row.storageKey,null);assert.deepEqual(new Uint8Array(row.content),new Uint8Array(png));
    await assertPhoto(photo.url);await assertPhoto();
   }finally{await rename(offline,root);}
  });
 }finally{
  if(server)await stopTestServer(server);
  if(userId)await prisma.organization.deleteMany({where:{ownerId:userId}});
  await prisma.user.deleteMany({where:{id:{in:[userId,otherId].filter(Boolean)}}});await prisma.$disconnect();
  const local=relative(parent,root);if(!local||isAbsolute(local)||local.startsWith('..'))throw Error('Unsafe fixture cleanup');
  await rm(root,{recursive:true,force:true});
 }
});
