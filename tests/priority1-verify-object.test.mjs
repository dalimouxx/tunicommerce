import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {verifyEncryptedObject} from '../scripts/priority1-verify-object.mjs';

test('P1 compares actual encrypted file bytes to the expected hash',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tuni-p1-verify-'));
 try{
  const path=join(dir,'test-only.gpg');
  const fake=randomBytes(256);
  await writeFile(path,fake);
  const digest=createHash('sha256').update(fake).digest('hex');
  assert.deepEqual(await verifyEncryptedObject(path,digest),{verified:true});
  await assert.rejects(verifyEncryptedObject(path,'0'.repeat(64)),/does not match/);
  for(const invalid of ['', 'None','not-a-hash','A'.repeat(64),'x'.repeat(64)])
   await assert.rejects(verifyEncryptedObject(path,invalid),/invalid/);
  await writeFile(path,Buffer.concat([fake,Buffer.from('changed')]));
  await assert.rejects(verifyEncryptedObject(path,digest),/does not match/);
  await writeFile(path,Buffer.alloc(0));
  await assert.rejects(verifyEncryptedObject(path,digest),/empty/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('P1 missing ciphertext never passes and no S3 or production database is contacted',async()=>{
 await assert.rejects(verifyEncryptedObject('', '0'.repeat(64)),/Missing encrypted backup file/);
 await assert.rejects(verifyEncryptedObject('/missing-test-only-file.gpg','0'.repeat(64)),/ENOENT/);
});
