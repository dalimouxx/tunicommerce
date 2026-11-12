import {randomUUID} from 'node:crypto';
import type {Prisma,BackgroundJob} from '@prisma/client';
import {prisma} from '../storage/client';
import type {State} from '../commerce/types';
import {seal,open,encryptionConfigured} from '../security/envelope';
import {finishJob,readJobPayload} from '../jobs/service';
import {orderEventChanges} from './order-events';
import {businessWebhookEvent,webhookJobPayload,webhookKey,webhookEndpointAllowed} from './webhook-policy';
import {webhookSubject,reserveWebhookBudget,queueWebhookDelivery,readWebhookEvent,readWebhookEndpoint,webhookEventFresh} from './webhook-store';
import {sendBusinessWebhook,WebhookRejected} from './webhook-transport';

/** The surrounding transaction owns the merchant advisory lock and commerce CAS. */
export async function enqueueBusinessWebhooks(tx:Prisma.TransactionClient,scope:{shopId:string}|{workspaceId:string;ownerId:string},before:State,after:State,version:number){
 const changes=orderEventChanges(before,after);if(!changes.length)return;
 const shop=await tx.shop.findUnique({where:'shopId' in scope?{id:scope.shopId}:{legacyWorkspaceId:scope.workspaceId},
  select:{id:true,legacyWorkspaceId:true,legacyWorkspace:{select:{ownerId:true}},webhook:true,
   memberships:{where:{role:'OWNER',active:true},select:{userId:true}},
   organization:{select:{ownerId:true,owner:{select:{emailVerifiedAt:true}}}}}});
 const config=shop?.webhook;
 if(!shop||!config?.enabled||config.ownerId!==shop.organization.ownerId||!shop.organization.owner.emailVerifiedAt||
  !shop.memberships.some(member=>member.userId===config.ownerId)||
  shop.legacyWorkspaceId&&shop.legacyWorkspace?.ownerId!==config.ownerId||'ownerId' in scope&&scope.ownerId!==config.ownerId)return;
 for(const change of changes){
  if(!await reserveWebhookBudget(tx,shop.id,true))continue;
  const id=randomUUID(),at=new Date();
  const payload=businessWebhookEvent.safeParse({id,type:change.event,occurredAt:at.toISOString(),shopId:shop.id,
   data:{orderId:change.orderId,reference:change.reference,status:change.status,totalMillimes:change.total,currency:'TND',commerceVersion:version}});
  const body=payload.success&&encryptionConfigured()?seal(payload.data,'webhook-event:'+id):null;
  let endpoint='';try{endpoint=readWebhookEndpoint(config);}catch{}
  const event=await tx.shopWebhookEvent.create({data:{id,shopId:shop.id,ownerId:config.ownerId,kind:change.event,body,createdAt:at}});
  const code=!payload.success?'INVALID_PAYLOAD':!encryptionConfigured()||!config.secretEnvelope||!endpoint?'CONFIGURATION_MISSING':
   !webhookEndpointAllowed(endpoint)?'WEBHOOK_REJECTED':null;
  const job=code?await tx.backgroundJob.create({data:{kind:'BUSINESS_WEBHOOK',subjectKey:webhookSubject(shop.id),
   dedupKey:'webhook-event:'+id+':initial',status:'FAILED',payload:null,errorCode:code,finishedAt:at}}):
   await queueWebhookDelivery(tx,shop.id,event.id,config.version,'initial');
  await tx.shopWebhookEvent.update({where:{id},data:{lastJobId:job.id}});
 }
}

export async function processBusinessWebhook(job:BackgroundJob,send:typeof sendBusinessWebhook=sendBusinessWebhook){
 if(!encryptionConfigured()){await finishJob(job,'CONFIGURATION_MISSING');return;}
 let payload:ReturnType<typeof webhookJobPayload.parse>;
 try{payload=webhookJobPayload.parse(readJobPayload(job));}
 catch{await finishJob(job,'INVALID_PAYLOAD');return;}
 if(job.subjectKey!==webhookSubject(payload.shopId)){await finishJob(job,'INVALID_PAYLOAD');return;}
 const event=await prisma.shopWebhookEvent.findUnique({where:{id:payload.eventId},include:{shop:{select:{webhook:true,
  legacyWorkspaceId:true,legacyWorkspace:{select:{ownerId:true}},
  memberships:{where:{active:true,role:'OWNER'},select:{userId:true}},
  organization:{select:{ownerId:true,owner:{select:{emailVerifiedAt:true}}}}}}}});
 const shop=event?.shop,config=shop?.webhook;
 if(!event||event.shopId!==payload.shopId||!config?.enabled||config.ownerId!==event.ownerId||
  config.version!==payload.destinationVersion||shop!.organization.ownerId!==event.ownerId||!shop!.organization.owner.emailVerifiedAt||
  !shop!.memberships.some(member=>member.userId===event.ownerId)||
  shop!.legacyWorkspaceId&&shop!.legacyWorkspace?.ownerId!==event.ownerId||!webhookEventFresh(event.createdAt)){
  await finishJob(job,'EXPIRED');return;
 }
 let secret:string,endpoint:string,body:ReturnType<typeof readWebhookEvent>;
 try{
  if(!config.secretEnvelope)throw Error();
  const key=open(config.secretEnvelope,'shop-webhook:'+payload.shopId) as {key?:unknown};
  secret=webhookKey.parse(key.key);
  endpoint=readWebhookEndpoint(config);if(!endpoint)throw Error();
 }catch{await finishJob(job,'CONFIGURATION_MISSING');return;}
 try{body=readWebhookEvent(event);}catch{await finishJob(job,'INVALID_PAYLOAD');return;}
 if(!webhookEndpointAllowed(endpoint)){await finishJob(job,'WEBHOOK_REJECTED');return;}
 try{
  await send({endpoint,secret,body:JSON.stringify(body),deliveryId:job.id,eventType:body.type});
  await finishJob(job);
 }catch(error){await finishJob(job,error instanceof WebhookRejected?'WEBHOOK_REJECTED':'DELIVERY_FAILED');}
}
