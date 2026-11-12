import type {Prisma,ShopWebhookEvent,ShopWebhook} from '@prisma/client';
import {open} from '../security/envelope';
import {enqueueJob} from '../jobs/service';
import {businessWebhookEvent,webhookUrl,WEBHOOK_DAILY_LIMIT,WEBHOOK_EVENT_MAX_AGE_MS} from './webhook-policy';
export const webhookSubject=(shopId:string)=>'shop-webhook:'+shopId;
export function readWebhookEndpoint(row:Pick<ShopWebhook,'shopId'|'endpointEnvelope'>){
 if(!row.endpointEnvelope)return '';
 const value=open(row.endpointEnvelope,'webhook-endpoint:'+row.shopId) as {url?:unknown};
 if(typeof value.url!=='string')throw Error('Destination indisponible');
 return webhookUrl(value.url).href;
}
export function readWebhookEvent(event:Pick<ShopWebhookEvent,'id'|'shopId'|'kind'|'body'|'createdAt'>){
 if(!event.body)throw Error('Événement indisponible');
 const value=businessWebhookEvent.parse(open(event.body,'webhook-event:'+event.id));
 if(value.id!==event.id||value.shopId!==event.shopId||value.type!==event.kind||Date.parse(value.occurredAt)!==event.createdAt.getTime())throw Error('Événement invalide');
 return value;
}
export function webhookEventFresh(createdAt:Date,now=new Date()){
 const age=now.getTime()-createdAt.getTime();return age>=-60_000&&age<=WEBHOOK_EVENT_MAX_AGE_MS;
}
/** Call only while holding the same owner advisory lock as order/config writes. */
export async function reserveWebhookBudget(tx:Prisma.TransactionClient,shopId:string,recordDrop:boolean){
 const row=await tx.shopWebhook.findUniqueOrThrow({where:{shopId}}),now=new Date(),day=now.toISOString().slice(0,10);
 const used=row.budgetDay===day?row.budgetCount:0;
 if(used>=WEBHOOK_DAILY_LIMIT){
  if(recordDrop)await tx.shopWebhook.update({where:{shopId},data:{droppedCount:{increment:1},lastDropAt:now}});
  return false;
 }
 await tx.shopWebhook.update({where:{shopId},data:{budgetDay:day,budgetCount:used+1}});return true;
}
export async function queueWebhookDelivery(tx:Prisma.TransactionClient,shopId:string,eventId:string,version:number,nonce:string){
 return enqueueJob(tx,{kind:'BUSINESS_WEBHOOK',subjectKey:webhookSubject(shopId),dedupKey:'webhook-event:'+eventId+':'+nonce,
  payload:{shopId,eventId,destinationVersion:version}});
}
export async function cancelPendingWebhooks(tx:Prisma.TransactionClient,shopId:string){
 await tx.backgroundJob.updateMany({where:{kind:'BUSINESS_WEBHOOK',subjectKey:webhookSubject(shopId),status:'PENDING'},
  data:{status:'CANCELLED',payload:null,finishedAt:new Date(),errorCode:null}});
}
