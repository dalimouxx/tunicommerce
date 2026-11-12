import {z} from 'zod';
import {encryptionConfigured} from '../security/envelope';
import {labels,type Status} from '../commerce/types';
export const WEBHOOK_DAILY_LIMIT=1000;
export const WEBHOOK_EVENT_MAX_AGE_MS=48*3600_000;
export const WEBHOOK_MAX_DELIVERIES=5;
const hostname=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export function webhookUrl(value:string){
 if(!value||value.length>2048||/[\s\\?#]/.test(value))throw Error('Adresse HTTPS invalide');
 const url=new URL(value);
 if(url.href.length>2048||url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port||
  url.hostname.length>253||!hostname.test(url.hostname)||
  /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/.test(url.hostname)||url.hostname==='home.arpa'||url.hostname.endsWith('.home.arpa'))throw Error('Adresse HTTPS invalide');
 return url;
}
export function allowedWebhookHosts(env:Record<string,string|undefined>=process.env){
 return [...new Set((env.WEBHOOK_ALLOWED_HOSTS||'').split(',').map(host=>host.trim().toLowerCase()).filter(host=>{
  try{return webhookUrl('https://'+host+'/').hostname===host;}catch{return false;}
 }))];
}
export function webhookEndpointAllowed(endpoint:string,env:Record<string,string|undefined>=process.env){
 try{return allowedWebhookHosts(env).includes(webhookUrl(endpoint).hostname);}catch{return false;}
}
export function webhooksConfigured(env:Record<string,string|undefined>=process.env){return encryptionConfigured(env)&&allowedWebhookHosts(env).length>0;}
export const webhookKey=z.string().regex(/^twh_[A-Za-z0-9_-]{43}$/);
const id=z.string().min(1).max(180);
export const businessWebhookEvent=z.object({id:z.string().uuid(),type:z.enum(['ORDER_CREATED','ORDER_STATUS_CHANGED']),
 occurredAt:z.iso.datetime(),shopId:id,data:z.object({orderId:id,reference:z.string().max(160),
  status:z.enum(Object.keys(labels) as [Status,...Status[]]),totalMillimes:z.number().int().nonnegative(),currency:z.literal('TND'),commerceVersion:z.number().int().nonnegative()}).strict()}).strict();
export const webhookJobPayload=z.object({shopId:id,eventId:z.string().uuid(),destinationVersion:z.number().int().positive()}).strict();
export const webhookAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('save'),endpoint:z.string().trim().max(2048),enabled:z.boolean(),expectedVersion:z.number().int().nonnegative()}).strict(),
 z.object({action:z.literal('rotate'),expectedVersion:z.number().int().nonnegative()}).strict(),
 z.object({action:z.literal('retry'),eventId:z.string().uuid(),requestId:z.string().uuid(),expectedVersion:z.number().int().nonnegative()}).strict()
]);
