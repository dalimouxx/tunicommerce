import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

export function encryptionConfigured(env:Record<string,string|undefined>=process.env){
 return typeof env.APP_ENCRYPTION_SECRET==='string'&&env.APP_ENCRYPTION_SECRET.length>=32;
}
function key(){
 if(!encryptionConfigured())throw Error('Chiffrement applicatif non configuré');
 return createHash('sha256').update(process.env.APP_ENCRYPTION_SECRET!).digest();
}
export function seal(value:unknown,context:string){
 const json=JSON.stringify(value);
 if(!json||Buffer.byteLength(json)>64000)throw Error('Contenu protégé trop volumineux');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 cipher.setAAD(Buffer.from(context));
 const body=Buffer.concat([cipher.update(json,'utf8'),cipher.final()]);
 return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),body:body.toString('base64')});
}
export function open(envelope:string,context:string):unknown{
 if(envelope.length>100000)throw Error('Contenu protégé invalide');
 try{
  const data=JSON.parse(envelope);
  if(data.v!==1||typeof data.iv!=='string'||typeof data.tag!=='string'||typeof data.body!=='string')throw Error();
  const iv=Buffer.from(data.iv,'base64'),tag=Buffer.from(data.tag,'base64');
  if(iv.length!==12||tag.length!==16)throw Error();
  const decipher=createDecipheriv('aes-256-gcm',key(),iv);
  decipher.setAAD(Buffer.from(context));decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.body,'base64')),decipher.final()]).toString('utf8'));
 }catch{throw Error('Contenu protégé invalide');}
}
