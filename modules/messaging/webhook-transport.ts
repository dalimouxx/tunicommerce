import {request as httpsRequest} from 'node:https';
import {checkServerIdentity} from 'node:tls';
import {isIP} from 'node:net';
import {Resolver} from 'node:dns/promises';
import type {ClientRequest} from 'node:http';
import {webhookUrl,webhookEndpointAllowed,webhookKey} from './webhook-policy';
import {webhookSignature} from './webhook-signature';

export class WebhookRejected extends Error{}
/** Conservative IPv4-only policy; special-purpose and multicast ranges are refused. */
export function publicWebhookIPv4(address:string){
 if(isIP(address)!==4)return false;
 const [a,b,c]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||
  a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&(c===0||c===2)||b===88&&c===99)||
  a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
async function resolveIPv4(host:string){
 const resolver=new Resolver({timeout:3000,tries:1}),timer=setTimeout(()=>resolver.cancel(),5000);timer.unref();
 try{return await resolver.resolve4(host);}finally{clearTimeout(timer);}
}
export type BusinessWebhookMessage={endpoint:string;secret:string;body:string;deliveryId:string;eventType:'ORDER_CREATED'|'ORDER_STATUS_CHANGED'};
type Dependencies={resolve?:(host:string)=>Promise<string[]>;request?:typeof httpsRequest};

/** No redirects, proxy inheritance, pooled sockets or second DNS resolution. */
export async function sendBusinessWebhook(input:BusinessWebhookMessage,deps:Dependencies={}){
 let url:URL;
 try{url=webhookUrl(input.endpoint);}catch{throw new WebhookRejected('Destination refusée');}
 if(!webhookEndpointAllowed(input.endpoint)||!webhookKey.safeParse(input.secret).success||
  !/^[0-9a-f-]{36}$/i.test(input.deliveryId)||!['ORDER_CREATED','ORDER_STATUS_CHANGED'].includes(input.eventType)||Buffer.byteLength(input.body)>16000)
  throw new WebhookRejected('Destination ou contenu refusé');
 const addresses=await (deps.resolve??resolveIPv4)(url.hostname);
 if(!addresses.length||addresses.length>64||addresses.some(address=>!publicWebhookIPv4(address)))throw new WebhookRejected('Adresse réseau refusée');
 const address=addresses[0],makeRequest=deps.request??httpsRequest;
 await new Promise<void>((resolve,reject)=>{
  let req:ClientRequest|undefined,done=false;
  const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(deadline);if(error)reject(error);else resolve();};
  const deadline=setTimeout(()=>{finish(Error('Délai de destination dépassé'));req?.destroy();},15000);deadline.unref();
  try{
   req=makeRequest({hostname:address,family:4,port:443,servername:url.hostname,path:url.pathname,method:'POST',
    agent:false,rejectUnauthorized:true,minVersion:'TLSv1.2',maxHeaderSize:8192,
    checkServerIdentity:(_host,cert)=>checkServerIdentity(url.hostname,cert),
    headers:{Host:url.hostname,'Content-Type':'application/json','Content-Length':String(Buffer.byteLength(input.body)),
     'User-Agent':'Tunicom-Webhooks/1.0','X-Tunicom-Event':input.eventType,'X-Tunicom-Delivery':input.deliveryId,
     'X-Tunicom-Signature':webhookSignature(input.secret,input.body)}},response=>{
    let bytes=0;
    response.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>65536){finish(new WebhookRejected('Réponse trop volumineuse'));response.destroy();req?.destroy();}});
    response.once('aborted',()=>finish(Error('Réponse interrompue')));
    response.once('error',error=>finish(error));
    response.once('end',()=>{
     const status=response.statusCode??0;
     if(status>=200&&status<300)finish();
     else if(status>=300&&status<500&&![408,425,429].includes(status))finish(new WebhookRejected('Destination non acceptante'));
     else finish(Error('Destination temporairement indisponible'));
    });
   });
   req.once('error',error=>finish(error));
   req.setTimeout(5000,()=>{finish(Error('Destination inactive'));req?.destroy();});
   req.end(input.body);
  }catch(error){finish(error instanceof Error?error:Error('Destination indisponible'));req?.destroy();}
 });
}
