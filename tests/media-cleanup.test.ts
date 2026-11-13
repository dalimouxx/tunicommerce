import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,chmod,writeFile,readFile,utimes,lstat,rm,symlink} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
import {initialState} from '../modules/commerce/seed';
const database=process.env.TEST_DATABASE_URL;
if(!database||database!==process.env.DATABASE_URL||!new URL(database).pathname.endsWith('_test'))throw Error('Media cleanup requires a disposable *_test database');
const {prisma}=await import('../modules/storage/client');
const {cleanupMediaCopies,scheduleMediaCleanup,mediaCleanupInput}=await import('../modules/media/cleanup');
const {writeMediaObject,mediaDigest}=await import('../modules/media/file-store');
const parent=resolve('.test-runtime');await mkdir(parent,{recursive:true});const root=await mkdtemp(join(parent,'media-gc-'));await chmod(root,0o700);
process.env.MEDIA_STORAGE_ROOT=root;process.env.MEDIA_STORAGE_MODE='filesystem-mirror';delete process.env.MEDIA_GC_ENABLED;
const now=new Date(Date.now()+8*86400000),mark=randomBytes(6).toString('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');
const users:string[]=[];let workspaceId='',liveKey='',photoId='';
async function account(){const user=await prisma.user.create({data:{email:'gc-'+mark+'-'+users.length+'@example.test',name:'Disposable media cleanup fixture',passwordHash:'unused-fixture',workspace:{create:{data:initialState(false) as never}}},include:{workspace:{select:{id:true}}}});users.push(user.id);return user.workspace!.id;}
async function object(workspace:string,content:Uint8Array){return writeMediaObject(workspace,content);}
const exists=async(path:string)=>{try{await lstat(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}};

test('Private media cleanup: preview, retention, live references, bounded passes and durable scheduling',async t=>{
 try{
  await prisma.maintenanceProgress.deleteMany({where:{id:'media-gc'}});
  workspaceId=await account();const live=await object(workspaceId,png);liveKey=live.storageKey;
  photoId=(await prisma.productMedia.create({data:{workspaceId,content:png,mimeType:'image/png',size:png.length,width:1,height:1,...live}})).id;
  await prisma.shopMedia.create({data:{workspaceId,slot:'logo',content:png,mimeType:'image/png',size:png.length,width:1,height:1,...live}});
  const orphan=await object(workspaceId,Buffer.from('unused-copy'));
  const fresh=await object(workspaceId,Buffer.from('recent-copy'));await utimes(join(root,fresh.storageKey),now,now);
  const directory=join(root,'v1',workspaceId),pending=join(directory,'.pending-'+randomUUID());await writeFile(pending,'interrupted-copy',{mode:0o600});
  const unknown=join(directory,'unrecognized-file');await writeFile(unknown,'never delete unknown files',{mode:0o600});
  await t.test('Preview selects only old recognized unreferenced files without deleting data',async()=>{
   const result=await cleanupMediaCopies({workspaceId},now);assert.equal(result.apply,false);assert.equal(result.eligible,2);assert.equal(result.deleted,0);assert.equal(result.unrecognized,1);
   assert.ok(await exists(join(root,orphan.storageKey)));assert.ok(await exists(pending));assert.ok(await exists(join(root,liveKey)));assert.ok(await exists(join(root,fresh.storageKey)));
   assert.equal(mediaCleanupInput.safeParse({workspaceId,after:randomUUID()}).success,false);assert.equal(mediaCleanupInput.safeParse({limit:11}).success,false);
  });
  await t.test('Apply respects shared references and is idempotent',async()=>{
   const before=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceId}});
   const result=await cleanupMediaCopies({workspaceId,apply:true},now);assert.equal(result.deleted,2);
   assert.equal(await exists(join(root,orphan.storageKey)),false);assert.equal(await exists(pending),false);
   assert.deepEqual(await readFile(join(root,liveKey)),png);assert.ok(await exists(unknown));assert.ok(await exists(join(root,fresh.storageKey)));
   await prisma.productMedia.delete({where:{id:photoId}});assert.equal((await cleanupMediaCopies({workspaceId,apply:true},now)).deleted,0,'Logo still references the shared bytes');
   const current=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceId}});assert.deepEqual(current.data,before.data);assert.equal(current.version,before.version);
   assert.equal((await prisma.shopMedia.findFirstOrThrow({where:{workspaceId}})).contentSha256,mediaDigest(png));
  });
  await t.test('One pass deletes at most 25 copies per account',async()=>{
   const target=await account();for(let i=0;i<30;i++)await object(target,Buffer.from('bounded-old-copy-'+i));
   const first=await cleanupMediaCopies({workspaceId:target,apply:true},now);assert.equal(first.deleted,25);
   assert.equal((await cleanupMediaCopies({workspaceId:target,apply:true},now)).deleted,5);
   assert.equal((await cleanupMediaCopies({workspaceId:target,apply:true},now)).deleted,0);
  });
  await t.test('A racing upload attaches its reference under the same account lock before cleanup can inspect it',async()=>{
   const target=await account(),content=Buffer.from('racing-reference'),copy=await object(target,content);
   let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),locked=new Promise<void>(resolve=>{entered=resolve;});
   const writer=prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id"=${target} FOR UPDATE`;
    await tx.productMedia.create({data:{workspaceId:target,content,mimeType:'image/png',size:content.length,width:1,height:1,...copy}});entered();await gate;
   },{timeout:10000});
   await locked;const cleaning=cleanupMediaCopies({workspaceId:target,apply:true},now);
   try{await pause(30);}finally{release();}
   await writer;assert.equal((await cleaning).deleted,0);assert.ok(await exists(join(root,copy.storageKey)));
  });
  await t.test('Scheduled cleanup is opt-in and advances a durable bounded cursor; concurrent leases skip safely',async()=>{
   assert.deepEqual(await scheduleMediaCleanup(now),{enabled:false,busy:false});
   for(let i=0;i<11;i++)await account();
   process.env.MEDIA_GC_ENABLED='true';
   await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('tunicom-media-gc'))`;assert.deepEqual(await scheduleMediaCleanup(now),{enabled:true,busy:true});});
   const sorted=await prisma.workspace.findMany({orderBy:{id:'asc'},select:{id:true}});
   const first=await scheduleMediaCleanup(now);assert.ok(first.enabled&&!first.busy);if(!first.enabled||first.busy)throw Error('Missing pass');
   assert.equal(first.workspaces,10);assert.equal(first.nextCursor,sorted[9].id);
   let progress=await prisma.maintenanceProgress.findUniqueOrThrow({where:{id:'media-gc'}});assert.equal(progress.cursor,first.nextCursor);
   for(let i=0;i<100&&progress.cursor;i++){await scheduleMediaCleanup(now);progress=await prisma.maintenanceProgress.findUniqueOrThrow({where:{id:'media-gc'}});}
   assert.equal(progress.cursor,null);assert.deepEqual(progress.lastCompletedAt,now);assert.ok(progress.version>=2);
   delete process.env.MEDIA_GC_ENABLED;
  });
  await t.test('Canonical byte retention is checked before any cleanup',async()=>{
   const target=await account(),copy=await object(target,Buffer.from('must-remain-without-canonical-guarantee'));
   await prisma.$executeRaw`ALTER TABLE "ProductMedia" ALTER COLUMN "content" DROP NOT NULL`;
   try{await assert.rejects(cleanupMediaCopies({workspaceId:target,apply:true},now),/Canonical media storage/);assert.ok(await exists(join(root,copy.storageKey)));}
   finally{await prisma.$executeRaw`ALTER TABLE "ProductMedia" ALTER COLUMN "content" SET NOT NULL`;}
  });
  await t.test('A failed storage pass cannot be reported as a successful complete cycle',async()=>{
   const original=await prisma.maintenanceProgress.findUniqueOrThrow({where:{id:'media-gc'}}),later=new Date(now.getTime()+86400000);
   process.env.MEDIA_GC_ENABLED='true';process.env.MEDIA_STORAGE_ROOT=join(root,'missing-mount');
   try{const failed=await scheduleMediaCleanup(later);assert.ok(failed.enabled&&!failed.busy);if(!failed.enabled||failed.busy)throw Error('Missing pass');assert.ok(failed.unavailable>0);}
   finally{process.env.MEDIA_STORAGE_ROOT=root;}
   let progress=await prisma.maintenanceProgress.findUniqueOrThrow({where:{id:'media-gc'}});
   for(let i=0;i<100&&progress.cursor;i++){await scheduleMediaCleanup(later);progress=await prisma.maintenanceProgress.findUniqueOrThrow({where:{id:'media-gc'}});}
   assert.equal(progress.lastError,'STORAGE_UNAVAILABLE');assert.deepEqual(progress.lastCompletedAt,original.lastCompletedAt);
   do{await scheduleMediaCleanup(later);progress=await prisma.maintenanceProgress.findUniqueOrThrow({where:{id:'media-gc'}});}while(progress.cursor);
   assert.equal(progress.lastError,null);assert.deepEqual(progress.lastCompletedAt,later);delete process.env.MEDIA_GC_ENABLED;
  });
  await t.test('Unrecognized links and oversized directories are preserved for operator inspection',async()=>{
   const foreign=await account(),foreignCopy=await object(foreign,Buffer.from('foreign-copy'));
   const link=join(directory,'0'.repeat(64));await symlink(join(root,'v1',foreign),link,process.platform==='win32'?'junction':'dir');
   await cleanupMediaCopies({workspaceId,apply:true},now);assert.ok((await lstat(link)).isSymbolicLink());assert.ok(await exists(join(root,foreignCopy.storageKey)));
   const target=await account();await object(target,Buffer.from('overflow-seed'));const oversized=join(root,'v1',target);
   await Promise.all(Array.from({length:512},(_,i)=>writeFile(join(oversized,'unknown-'+i),'x',{mode:0o600})));
   const result=await cleanupMediaCopies({workspaceId:target,apply:true},now);assert.equal(result.blocked,1);assert.equal(result.deleted,0);
  });
 }finally{
  await prisma.maintenanceProgress.deleteMany({where:{id:'media-gc'}});
  await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();
  const local=relative(parent,root);if(!local||isAbsolute(local)||local.startsWith('..'))throw Error('Unsafe fixture cleanup');
  await rm(root,{recursive:true,force:true});
 }
});
