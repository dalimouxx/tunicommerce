import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {writeFile,unlink,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prisma} from '../modules/storage/client.ts';
import {initialState} from '../modules/commerce/seed.ts';
import {writeMediaObject,readMediaObject,mediaDigest} from '../modules/media/file-store.ts';
if(process.env.TUNICOM_CONTAINER_TEST!=='1'||new URL(process.env.APP_URL).hostname!=='platform.example.test')throw Error('Disposable container test only');
const [action,mark]=process.argv.slice(2);
if(!/^[a-f0-9]{20}$/.test(mark||''))throw Error('Invalid test identity');
function id(kind){const hex=createHash('sha256').update(mark+kind).digest('hex');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);}
const userId=id('user'),workspaceId=id('workspace'),photoId=id('photo');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');
try{
 if(action==='permissions'){
  const [row]=await prisma.$queryRaw`SELECT current_user AS name, r.rolsuper AS super, r.rolcreatedb AS createdb, r.rolcreaterole AS createrole,
    has_schema_privilege(current_user,'public','CREATE') AS schema_create,
    has_database_privilege(current_user,current_database(),'CREATE') AS db_create,
    has_database_privilege(current_user,current_database(),'TEMP') AS temporary,
    has_table_privilege(current_user,'public."_prisma_migrations"','SELECT') AS migrations
    FROM pg_roles r WHERE r.rolname=current_user`;
  assert.equal(row.name,'tunicom_app');for(const key of ['super','createdb','createrole','schema_create','db_create','temporary','migrations'])assert.equal(row[key],false,key);
  assert.notEqual(process.getuid(),0);assert.equal(process.env.POSTGRES_PASSWORD,undefined);assert.equal(process.env.APP_DATABASE_PASSWORD,undefined);
  assert.equal(existsSync('node_modules/prisma/build/index.js'),false,'Migration CLI must not be shipped in runtime');assert.equal(existsSync('.env'),false,'No baked environment file');
  let writable=false;try{const handle=await open('/app/package.json','r+');writable=true;await handle.close();}catch{}
  assert.equal(writable,false);
  await writeFile('/app/.next/cache/container-probe','fixture');await unlink('/app/.next/cache/container-probe');
 }else if(action==='seed'){
  await prisma.user.create({data:{id:userId,email:'vps-ci-'+mark+'@example.test',name:'Disposable container fixture',passwordHash:'not-a-login-password',
   workspace:{create:{id:workspaceId,data:initialState(false),slug:'vps-ci-'+mark,published:true,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)}}}});
  const mirror=await writeMediaObject(workspaceId,png);
  await prisma.productMedia.create({data:{id:photoId,workspaceId,content:png,mimeType:'image/png',size:png.length,width:1,height:1,...mirror}});
 }else if(action==='verify'){
  const photo=await prisma.productMedia.findUniqueOrThrow({where:{id:photoId}});assert.equal(mediaDigest(photo.content),mediaDigest(png));
  assert.deepEqual(await readMediaObject(workspaceId,photo.storageKey,photo.contentSha256,photo.size),new Uint8Array(png));
 }else if(action==='worker-active'){
  assert.equal(await prisma.workerHeartbeat.count({where:{stoppedAt:null,lastSeenAt:{gte:new Date(Date.now()-120000)}}}),1);
 }else if(action==='worker-stopped'){
  assert.equal(await prisma.workerHeartbeat.count({where:{stoppedAt:null}}),0);assert.ok(await prisma.workerHeartbeat.count({where:{stoppedAt:{not:null}}}));
 }else throw Error('Unknown probe');
 process.stdout.write(JSON.stringify({ok:true,action,photoId,digest:mediaDigest(png)})+'\n');
}finally{await prisma.$disconnect();}
