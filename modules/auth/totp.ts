import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

export function authenticatorSecret(){return randomBytes(20);}
export function base32(secret:Buffer){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let buffer=0,bits=0,result='';
 for(const value of secret){buffer=(buffer<<8)|value;bits+=8;while(bits>=5){bits-=5;result+=alphabet[(buffer>>>bits)&31];}}
 if(bits)result+=alphabet[(buffer<<(5-bits))&31];
 return result;
}
/** RFC 6238, SHA-1, 30-second periods; 8 digits are supported for the RFC test vectors. */
export function totpCode(secret:Buffer,step:number,digits=6){
 if(!Number.isSafeInteger(step)||step<0||![6,8].includes(digits)||secret.length<20)throw Error('Paramètres TOTP invalides');
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
 const hash=createHmac('sha1',secret).update(counter).digest(),offset=hash[hash.length-1]&15;
 return String((hash.readUInt32BE(offset)&0x7fffffff)%10**digits).padStart(digits,'0');
}
export function matchingTotpStep(secret:Buffer,code:string,now=Date.now()){
 if(!/^\d{6}$/.test(code))return null;
 const current=Math.floor(now/30000);
 for(const offset of [0,-1,1]){
  const step=current+offset;if(step<0)continue;
  if(timingSafeEqual(Buffer.from(code),Buffer.from(totpCode(secret,step))))return step;
 }
 return null;
}
