import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBackupConfig} from '../scripts/priority1-backup-config.mjs';

const standard={
 P1_S3_ENDPOINT:'https://eu.example-storage.test',P1_S3_BUCKET:'tuni-private-backups',
 P1_S3_REGION:'eu-central-1',P1_S3_ACCESS_KEY_ID:'fake-access',
 P1_S3_SECRET_ACCESS_KEY:'fake-secret',
 P1_BACKUP_PASSPHRASE:'A'.repeat(48),
 P1_BACKUP_DATABASE_URL:'postgresql://readonly:test@neon.example.test:5432/tunic?sslmode=require'
};
test('backup configuration requires TLS, object storage and a strong passphrase',()=>{
 assert.equal(validateBackupConfig(standard),true);
 for(const field of Object.keys(standard)){
  assert.throws(()=>validateBackupConfig({...standard,[field]:''}),/Missing required/);
 }
 assert.throws(()=>validateBackupConfig({...standard,P1_S3_ENDPOINT:'http://bucket.test'}),/HTTPS/);
 assert.throws(()=>validateBackupConfig({...standard,P1_BACKUP_PASSPHRASE:'short'}),/at least 32/);
 assert.throws(()=>validateBackupConfig({...standard,P1_BACKUP_DATABASE_URL:'postgresql://private.test/db'}),/sslmode/);
});
test('restore only accepts an explicit managed object key, never URL/path traversal',()=>{
 const key='tunicommerce/neon/2026/11/04/20261104T160101Z-12345-1.dump.gpg';
 assert.equal(validateBackupConfig({...standard,P1_BACKUP_OBJECT_KEY:key},{restore:true}),true);
 for(const bad of ['../secrets','tunicommerce/neon/../../secret','https://evil.example/b',
  'tunicommerce/neon/2026/11/04/file.sql']){
  assert.throws(()=>validateBackupConfig({...standard,P1_BACKUP_OBJECT_KEY:bad},{restore:true}),/Invalid P1_BACKUP_OBJECT_KEY/);
 }
});
test('backup validator never echoes credentials in errors',()=>{
 const secret='SECRET_SHOULD_NEVER_LEAK';
 assert.throws(()=>validateBackupConfig({...standard,P1_S3_ENDPOINT:'not a URL',
  P1_BACKUP_PASSPHRASE:secret.repeat(3)}),e=>{
   assert.equal(e.message.includes(secret),false);
   return true;
 });
});
