import {createHash,timingSafeEqual} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

/** Compare the actual encrypted bytes with S3's private stored digest.
 * No ciphertext or data is logged and plaintext is never loaded.
 */
export async function verifyEncryptedObject(path,expectedDigest){
 if(typeof expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(expectedDigest))
  throw Error('Missing or invalid encrypted backup SHA-256 metadata');
 if(typeof path!=='string'||!path.trim())throw Error('Missing encrypted backup file');
 const metadata=await stat(path);
 if(!metadata.isFile()||metadata.size===0)
  throw Error('Encrypted backup is missing or empty');
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(path))hash.update(chunk);
 const computed=hash.digest();
 if(!timingSafeEqual(computed,Buffer.from(expectedDigest,'hex')))
  throw Error('Encrypted backup content does not match the stored SHA-256');
 return {verified:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 verifyEncryptedObject(process.env.P1_ENCRYPTED_BACKUP_PATH,process.env.P1_ENCRYPTED_BACKUP_SHA256)
  .then(()=>console.log('Encrypted object content digest verified before isolated restore.'))
  .catch(error=>{
   console.error(error instanceof Error?error.message:'Encrypted object verification failed');
   process.exitCode=1;
  });
}
