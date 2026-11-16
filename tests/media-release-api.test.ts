import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,mkdtemp,chmod,writeFile,rm,utimes} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {initialState} from '../modules/commerce/seed';
const database=process.env.TEST_DATABASE_URL;
if(!database||database!==process.env.DATABASE_URL||!new URL(database).pathname.endsWith('_test'))throw Error('Media release requires a disposable *_test database');
const {prisma}=await import('../modules/storage/client');
const {mediaReleaseBatch}=await import('../modules/media/release');
const {mediaMirrorStatus}=await import('../modules/media/mirror-operations');
const {readMediaContent,mediaReadSelect}=await import('../modules/media/content-store');
const {writeMediaObject}=await import('../modules/media/file-store');
const {cleanupMediaCopies}=await import('../modules/media/cleanup');
const parent=resolve('.test-runtime');await mkdir(parent,{recursive:true});
const root=await mkdtemp(join(parent,'media-release-'));await chmod(root,0o700);
process.env.MEDIA_STORAGE_ROOT=root;process.env.MEDIA_STORAGE_MODE='filesystem-mirror';
const mark=randomBytes(6).toString('hex'),marker=join(root,'.backup-status.json');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');
const other=Buffer.concat([png,Buffer.from('second')]),third=Buffer.concat([png,Buffer.from('third')]);
let userId='',workspaceId='';
const backup=(at:number,ok=true)=>writeFile(marker,JSON.stringify({ok,at}),{mode:0o600});
const photo=async(bytes:Buffer,copy=true)=>{
 const pointer=copy?await writeMediaObject(workspaceId,bytes):{storageKey:null,contentSha256:null};
 return prisma.productMedia.create({data:{workspaceId,content:new Uint8Array(bytes),mimeType:'image/png',size:bytes.length,width:1,height:1,...pointer}});
};
const row=(id:string)=>prisma.productMedia.findUniqueOrThrow({where:{id}});
const release=(limit=25)=>mediaReleaseBatch({kind:'product',action:'release',workspaceId,limit});

test('Opt-in media release: guarded by mode and fresh backup, verified bytes only, reversible',async t=>{
 try{
  const user=await prisma.user.create({data:{email:'release-'+mark+'@example.test',name:'Media release fixture',passwordHash:'unused-fixture',workspace:{create:{data:initialState(false) as never}}},include:{workspace:true}});
  userId=user.id;workspaceId=user.workspace!.id;
  const copied=await photo(png),uncopied=await photo(other,false),corrupted=await photo(third);
  await writeFile(join(root,corrupted.storageKey!),Buffer.alloc(third.length),{mode:0o600});

  await t.test('Release is refused outside filesystem-primary and without a fresh media backup',async()=>{
   await assert.rejects(release(),/filesystem-primary/);
   process.env.MEDIA_STORAGE_MODE='filesystem-primary';
   await assert.rejects(release(),/Sauvegarde/);
   await backup(Math.floor(Date.now()/1000)-31*3600);await assert.rejects(release(),/Sauvegarde/);
   await backup(Math.floor(Date.now()/1000),false);await assert.rejects(release(),/Sauvegarde/);
   assert.ok((await row(copied.id)).content);
  });
  await t.test('Only rows whose file matches byte-for-byte are released',async()=>{
   await backup(Math.floor(Date.now()/1000));
   const result=await release();
   assert.equal(result.action,'release');if(!('released' in result))throw Error('Wrong result');
   assert.equal(result.released,1);assert.equal(result.skipped,1);assert.equal(result.scanned,2);
   const released=await row(copied.id);assert.equal(released.content,null);assert.ok(released.contentReleasedAt);assert.equal(released.storageKey,copied.storageKey);
   assert.ok((await row(uncopied.id)).content);assert.ok((await row(corrupted.id)).content);
   const status=await mediaMirrorStatus();assert.equal(status.mode,'filesystem-primary');assert.equal(status.canonicalBytesRetained,false);assert.equal(status.mediaBackupFresh,true);
  });
  await t.test('A released photo is served from disk and never falls back to the database',async()=>{
   const current=await prisma.productMedia.findUniqueOrThrow({where:{id:copied.id},select:mediaReadSelect()});
   assert.deepEqual(new Uint8Array(await readMediaContent('product',current)),new Uint8Array(png));
   process.env.MEDIA_STORAGE_MODE='database';
   const databaseMode=await prisma.productMedia.findUniqueOrThrow({where:{id:copied.id},select:mediaReadSelect()});
   assert.deepEqual(new Uint8Array(await readMediaContent('product',databaseMode)),new Uint8Array(png));
   process.env.MEDIA_STORAGE_MODE='filesystem-primary';
  });
  await t.test('The database refuses invalid releases and pointer changes on released rows',async()=>{
   await assert.rejects(prisma.$executeRaw`UPDATE "ProductMedia" SET "content"=NULL WHERE "id"=${uncopied.id}`,/media_release_invalid|content_or_copy/);
   await assert.rejects(prisma.$executeRaw`UPDATE "ProductMedia" SET "storageKey"=${corrupted.storageKey} WHERE "id"=${copied.id}`,/media_release_invalid/);
   await assert.rejects(prisma.$executeRaw`UPDATE "ProductMedia" SET "size"=1 WHERE "id"=${copied.id}`,/media_release_invalid/);
   await assert.rejects(prisma.$executeRaw`INSERT INTO "ProductMedia" ("id","workspaceId","mimeType","size","width","height","storageKey","contentSha256","contentReleasedAt")
    VALUES (gen_random_uuid(),${workspaceId},'image/png',${png.length},1,1,${copied.storageKey},${copied.contentSha256},now())`,/media_release_invalid/);
   assert.equal((await row(copied.id)).storageKey,copied.storageKey);
  });
  await t.test('Cleanup keeps the only copy of a released photo',async()=>{
   const later=new Date(Date.now()+30*86400000);await utimes(join(root,copied.storageKey!),new Date(0),new Date(0));
   const result=await cleanupMediaCopies({workspaceId,apply:true},later);assert.equal(result.blocked,0);
   const current=await prisma.productMedia.findUniqueOrThrow({where:{id:copied.id},select:mediaReadSelect()});
   assert.deepEqual(new Uint8Array(await readMediaContent('product',current)),new Uint8Array(png));
  });
  await t.test('A missing file is reported as unavailable, then restore puts verified bytes back',async()=>{
   const path=join(root,copied.storageKey!);await rm(path);
   const current=await prisma.productMedia.findUniqueOrThrow({where:{id:copied.id},select:mediaReadSelect()});
   await assert.rejects(readMediaContent('product',current,async()=>{throw Error('database fallback must not run');}),/indisponible/);
   const failed=await mediaReleaseBatch({kind:'product',action:'restore',workspaceId});if(!('restored' in failed))throw Error('Wrong result');
   assert.equal(failed.restored,0);assert.equal(failed.unavailable,1);
   await writeMediaObject(workspaceId,png);
   const restored=await mediaReleaseBatch({kind:'product',action:'restore',workspaceId});if(!('restored' in restored))throw Error('Wrong result');
   assert.equal(restored.restored,1);
   const back=await row(copied.id);assert.deepEqual(new Uint8Array(back.content!),new Uint8Array(png));assert.equal(back.contentReleasedAt,null);assert.equal(back.storageKey,copied.storageKey);
   assert.equal((await mediaMirrorStatus()).canonicalBytesRetained,true);
  });
 }finally{
  process.env.MEDIA_STORAGE_MODE='filesystem-mirror';
  if(workspaceId)await prisma.productMedia.deleteMany({where:{workspaceId}});
  if(userId)await prisma.user.deleteMany({where:{id:userId}});
  await rm(root,{recursive:true,force:true});await prisma.$disconnect();
 }
});
