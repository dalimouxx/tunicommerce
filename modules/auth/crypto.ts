import {randomBytes,scrypt as derive,timingSafeEqual,createHash} from 'node:crypto';
const scrypt=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function secretMatches(a:string,b:string){return timingSafeEqual(Buffer.from(digest(a),'hex'),Buffer.from(digest(b),'hex'));}
export async function hashPassword(password:string){
  const salt=randomBytes(16).toString('hex');
  const key=await scrypt(password,salt);
  return `scrypt:32768:8:1:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password:string,stored:string){
  const parts=stored.split(':');
  if(parts.length!==6||parts[0]!=='scrypt'||parts[1]!=='32768'||parts[2]!=='8'||parts[3]!=='1'||!/^[a-f0-9]{32}$/.test(parts[4])||!/^[a-f0-9]{128}$/.test(parts[5]))return false;
  const key=await scrypt(password,parts[4]);
  return timingSafeEqual(key,Buffer.from(parts[5],'hex'));
}
export function newSession(){const token=randomBytes(32).toString('hex');return {token,tokenHash:digest(token),expiresAt:new Date(Date.now()+7*24*60*60*1000)};}
