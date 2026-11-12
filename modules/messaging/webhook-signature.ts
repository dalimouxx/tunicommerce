import {createHmac,timingSafeEqual} from 'node:crypto';
export function webhookSignature(secret:string,body:string|Uint8Array,timestamp=Math.floor(Date.now()/1000)){
 if(!Number.isSafeInteger(timestamp)||timestamp<0)throw Error('Horodatage invalide');
 const mac=createHmac('sha256',secret).update(String(timestamp)+'.').update(body).digest('hex');
 return 't='+timestamp+',v1='+mac;
}
/** Receivers must verify the exact raw bytes before JSON parsing or side effects. */
export function verifyWebhookSignature(secret:string,body:string|Uint8Array,header:string,nowSeconds=Math.floor(Date.now()/1000)){
 const match=/^t=(\d{10}),v1=([0-9a-f]{64})$/.exec(header);
 if(!match||!Number.isSafeInteger(nowSeconds)||Math.abs(nowSeconds-Number(match[1]))>300)return false;
 const expected=webhookSignature(secret,body,Number(match[1])).split('v1=')[1];
 return timingSafeEqual(Buffer.from(match[2],'hex'),Buffer.from(expected,'hex'));
}
