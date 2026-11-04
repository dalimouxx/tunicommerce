import {pathToFileURL} from 'node:url';

/**
 * Fail closed before any backup read or S3 upload. No secret values are printed.
 * All config is injected by GitHub Actions secrets, never committed to source.
 */
export function validateBackupConfig(env, {restore=false}={}){
 const required=[
  'P1_S3_ENDPOINT','P1_S3_BUCKET','P1_S3_REGION',
  'P1_S3_ACCESS_KEY_ID','P1_S3_SECRET_ACCESS_KEY','P1_BACKUP_PASSPHRASE',
  restore?'P1_BACKUP_OBJECT_KEY':'P1_BACKUP_DATABASE_URL'
 ];
 for(const key of required)if(!env[key]?.trim())throw Error('Missing required secret/input: '+key);
 if(env.P1_BACKUP_PASSPHRASE.length<32)throw Error('P1_BACKUP_PASSPHRASE must contain at least 32 characters');
 let endpoint;
 try{endpoint=new URL(env.P1_S3_ENDPOINT);}catch{throw Error('Invalid P1_S3_ENDPOINT URL');}
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)
  throw Error('P1_S3_ENDPOINT must be an HTTPS origin without userinfo or query');
 if(!/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,61}[a-zA-Z0-9]$/.test(env.P1_S3_BUCKET))
  throw Error('Invalid P1_S3_BUCKET');
 if(!/^[a-zA-Z0-9-]{2,40}$/.test(env.P1_S3_REGION))
  throw Error('Invalid P1_S3_REGION');
 if(restore){
  // Explicit object name; prevents arbitrary bucket reads or path traversal.
  if(!/^tunicommerce\/neon\/\d{4}\/\d{2}\/\d{2}\/\d{8}T\d{6}Z-\d+-\d+\.dump\.gpg$/.test(env.P1_BACKUP_OBJECT_KEY))
   throw Error('Invalid P1_BACKUP_OBJECT_KEY');
 }else{
  let database;
  try{database=new URL(env.P1_BACKUP_DATABASE_URL);}catch{throw Error('Invalid P1_BACKUP_DATABASE_URL');}
  if(!['postgresql:','postgres:'].includes(database.protocol)||
   !['require','verify-ca','verify-full'].includes(database.searchParams.get('sslmode')||''))
   throw Error('P1_BACKUP_DATABASE_URL must use PostgreSQL with sslmode=require or stronger');
 }
 return true;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  validateBackupConfig(process.env,{restore:process.argv.includes('--restore')});
  console.log('Configuration validated; no secrets exposed.');
 }catch(error){
  console.error(error instanceof Error?error.message:'Backup configuration invalid');
  process.exitCode=1;
 }
}
