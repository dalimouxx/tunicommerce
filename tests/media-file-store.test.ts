import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile,readFile,symlink,chmod,stat,open} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {mediaMirrorEnabled,mediaObjectKey,mediaDigest,writeMediaObject,readMediaObject,MEDIA_MAX_BYTES} from '../modules/media/file-store';
test('Private media files: strict scope, atomic copies, integrity and bounded capacity',async t=>{
 const parent=resolve('.test-runtime');await mkdir(parent,{recursive:true});
 const root=await mkdtemp(join(parent,'media-unit-'));await chmod(root,0o700);
 const previous=process.env.MEDIA_STORAGE_ROOT;process.env.MEDIA_STORAGE_ROOT=root;
 async function removeFixture(path:string){const local=relative(parent,resolve(path));if(!local||isAbsolute(local)||local.startsWith('..'))throw Error('Unsafe fixture cleanup');await rm(path,{recursive:true,force:true});}
 const workspace=randomUUID(),bytes=Buffer.from('private-media-fixture'),digest=mediaDigest(bytes);
 try{
  await t.test('Mode is explicit and object keys cannot cross workspaces or traverse paths',async()=>{
   assert.equal(mediaMirrorEnabled({}),false);assert.equal(mediaMirrorEnabled({MEDIA_STORAGE_MODE:'filesystem-mirror'}),true);
   for(const id of ['../public',workspace+'/../other','UPPERCASE',''])assert.throws(()=>mediaObjectKey(id,digest));
   assert.throws(()=>mediaObjectKey(workspace,'../secret'));
   const key=mediaObjectKey(workspace,digest);
   await assert.rejects(readMediaObject(randomUUID(),key,digest,bytes.length));
   await assert.rejects(readMediaObject(workspace,key,digest,MEDIA_MAX_BYTES+1));
  });
  await t.test('Concurrent identical writes are immutable and round-trip exact bytes',async()=>{
   const copies=await Promise.all(Array.from({length:4},()=>writeMediaObject(workspace,bytes)));
   assert.ok(copies.every(item=>item.storageKey===copies[0].storageKey));
   assert.deepEqual(await readMediaObject(workspace,copies[0].storageKey,digest,bytes.length),new Uint8Array(bytes));
   if(process.platform!=='win32')assert.equal((await stat(join(root,copies[0].storageKey))).mode&0o777,0o600);
  });
  await t.test('Corrupt, truncated and oversized objects are refused without overwriting them',async()=>{
   const key=mediaObjectKey(workspace,digest),path=join(root,key);
   await writeFile(path,Buffer.alloc(bytes.length,1));await assert.rejects(readMediaObject(workspace,key,digest,bytes.length));
   await assert.rejects(writeMediaObject(workspace,bytes));assert.deepEqual(await readFile(path),Buffer.alloc(bytes.length,1));
   await writeFile(path,Buffer.alloc(bytes.length+1));await assert.rejects(readMediaObject(workspace,key,digest,bytes.length));
   await assert.rejects(writeMediaObject(workspace,Buffer.alloc(MEDIA_MAX_BYTES+1)));
  });
  await t.test('Missing roots and application-served paths cannot become media stores',async()=>{
   for(const value of [join(root,'missing'),'relative-path',resolve('public'),resolve('.')]){
    process.env.MEDIA_STORAGE_ROOT=value;await assert.rejects(writeMediaObject(workspace,bytes));
   }
   process.env.MEDIA_STORAGE_ROOT=root;
  });
  await t.test('Directory links cannot redirect writes outside the configured root',async()=>{
   const other=await mkdtemp(join(parent,'media-link-target-'));await chmod(other,0o700);
   try{
    const victim=randomUUID(),path=join(root,'v1',victim);await symlink(other,path,process.platform==='win32'?'junction':'dir');
    await assert.rejects(writeMediaObject(victim,bytes));
   }finally{await removeFixture(other);}
  });
  await t.test('A bounded directory refuses extra copies at its file ceiling',async()=>{
   const victim=randomUUID(),path=join(root,'v1',victim);await mkdir(path,{mode:0o700});
   await Promise.all(Array.from({length:512},(_,i)=>writeFile(join(path,'fixture-'+i),'x',{mode:0o600})));
   await assert.rejects(writeMediaObject(victim,bytes));
  });
  await t.test('The physical workspace budget refuses another copy before the disk fills',async()=>{
   const victim=randomUUID(),path=join(root,'v1',victim);await mkdir(path,{mode:0o700});
   const handle=await open(join(path,'retained-fixture'),'wx',0o600);try{await handle.truncate(64*1024*1024);}finally{await handle.close();}
   await assert.rejects(writeMediaObject(victim,bytes));
  });
 }finally{
  if(previous===undefined)delete process.env.MEDIA_STORAGE_ROOT;else process.env.MEDIA_STORAGE_ROOT=previous;
  await removeFixture(root);
 }
});
