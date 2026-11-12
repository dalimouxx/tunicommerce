import {randomBytes} from 'node:crypto';
import type {z} from 'zod';
import {prisma} from '../storage/client';
import {homeOwner} from '../shops/home-service';
import {HttpError} from '../auth/http';
import {encryptionConfigured,seal} from '../security/envelope';
import {webhookAction,webhookUrl,webhookEndpointAllowed,webhooksConfigured,WEBHOOK_DAILY_LIMIT,WEBHOOK_MAX_DELIVERIES} from './webhook-policy';
import {webhookSubject,readWebhookEvent,readWebhookEndpoint,webhookEventFresh,reserveWebhookBudget,queueWebhookDelivery,cancelPendingWebhooks} from './webhook-store';

export async function readWebhookSettings(userId:string,shopId:string){
 const shop=await homeOwner(userId,shopId);
 const [row,user,events]=await Promise.all([
  prisma.shopWebhook.findUnique({where:{shopId}}),
  prisma.user.findUniqueOrThrow({where:{id:userId},select:{emailVerifiedAt:true}}),
  prisma.shopWebhookEvent.findMany({where:{shopId,ownerId:userId},take:30,orderBy:[{createdAt:'desc'},{id:'desc'}]})
 ]);
 const owned=row?.ownerId===userId;
 const jobs=await prisma.backgroundJob.findMany({where:{kind:'BUSINESS_WEBHOOK',subjectKey:webhookSubject(shopId),
  id:{in:events.flatMap(event=>event.lastJobId?[event.lastJobId]:[])}},
  select:{id:true,status:true,attempts:true,maxAttempts:true,errorCode:true,createdAt:true,finishedAt:true}});
 const byId=new Map(jobs.map(job=>[job.id,job]));
 const enabled=owned&&row.enabled;let endpoint='',endpointReadable=true;
 if(owned)try{endpoint=readWebhookEndpoint(row);}catch{endpointReadable=false;}
 return {shopName:shop.name,endpoint,endpointReadable,enabled,version:row?.version??0,keyConfigured:owned&&!!row.secretEnvelope,
  encryptionReady:encryptionConfigured(),configured:webhooksConfigured(),allowed:webhookEndpointAllowed(endpoint),verified:!!user.emailVerifiedAt,
  budgetLimit:WEBHOOK_DAILY_LIMIT,budgetUsed:owned&&row.budgetDay===new Date().toISOString().slice(0,10)?row.budgetCount:0,
  droppedCount:owned?row.droppedCount:0,lastDropAt:owned?row.lastDropAt?.toISOString()??null:null,
  events:events.map(event=>{
   let body:ReturnType<typeof readWebhookEvent>|null=null;try{body=readWebhookEvent(event);}catch{}
   const job=event.lastJobId?byId.get(event.lastJobId):undefined;
   return {id:event.id,type:event.kind,reference:body?.data.reference??null,orderStatus:body?.data.status??null,
    createdAt:event.createdAt.toISOString(),deliveryCount:event.deliveryCount,
    job:job?{...job,createdAt:job.createdAt.toISOString(),finishedAt:job.finishedAt?.toISOString()??null}:null,
    canRetry:!!(enabled&&user.emailVerifiedAt&&webhooksConfigured()&&webhookEndpointAllowed(endpoint)&&body&&webhookEventFresh(event.createdAt)&&
     event.deliveryCount<WEBHOOK_MAX_DELIVERIES&&job&&['FAILED','CANCELLED'].includes(job.status))};
  })};
}

export async function applyWebhookAction(userId:string,shopId:string,input:z.infer<typeof webhookAction>){
 let revealed:string|undefined;
 const outcome=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;
  await homeOwner(userId,shopId,tx);
  const row=await tx.shopWebhook.findUnique({where:{shopId}}),owned=row?.ownerId===userId;
  const version=row?.version??0;
  if(input.expectedVersion!==version)throw new HttpError(409,'Les réglages ont changé. Actualisez le journal pour les comparer.');
  if(input.action==='rotate'){
   if(!encryptionConfigured())throw new HttpError(503,'Le chiffrement doit être configuré par l’exploitant.');
   revealed='twh_'+randomBytes(32).toString('base64url');
   const data={ownerId:userId,enabled:false,endpointEnvelope:owned?row.endpointEnvelope:null,version:version+1,
    secretEnvelope:seal({key:revealed},'shop-webhook:'+shopId)};
   await tx.shopWebhook.upsert({where:{shopId},create:{shopId,...data},update:data});
   await cancelPendingWebhooks(tx,shopId);return {alreadyApplied:false};
  }
  if(input.action==='save'){
   let endpoint='';
   if(input.endpoint){try{endpoint=webhookUrl(input.endpoint).href;}catch{throw new HttpError(400,'Utilisez une adresse HTTPS sans identifiant, paramètre, fragment ou port personnalisé.');}}
   if(endpoint&&!encryptionConfigured())throw new HttpError(503,'Le chiffrement doit être configuré avant d’enregistrer une destination.');
   const secretEnvelope=owned?row.secretEnvelope:null;
   if(input.enabled){
    if(!webhooksConfigured())throw new HttpError(503,'Les envois externes ne sont pas configurés par l’exploitant.');
    if(!endpoint||!webhookEndpointAllowed(endpoint))throw new HttpError(403,'Cette destination doit être autorisée par l’exploitant.');
    if(!secretEnvelope)throw new HttpError(409,'Créez une clé de signature avant l’activation.');
    const user=await tx.user.findUniqueOrThrow({where:{id:userId},select:{emailVerifiedAt:true}});
    if(!user.emailVerifiedAt)throw new HttpError(409,'Vérifiez votre adresse dans la sécurité du compte avant l’activation.');
   }
   const data={ownerId:userId,endpointEnvelope:endpoint?seal({url:endpoint},'webhook-endpoint:'+shopId):null,enabled:input.enabled,secretEnvelope,version:version+1};
   await tx.shopWebhook.upsert({where:{shopId},create:{shopId,...data},update:data});
   await cancelPendingWebhooks(tx,shopId);return {alreadyApplied:false};
  }
  let endpoint='';if(owned)try{endpoint=readWebhookEndpoint(row);}catch{}
  if(!owned||!row.enabled||!row.secretEnvelope||!webhooksConfigured()||!webhookEndpointAllowed(endpoint))
   throw new HttpError(409,'Activez une destination autorisée avant de relancer.');
  const user=await tx.user.findUniqueOrThrow({where:{id:userId},select:{emailVerifiedAt:true}});
  if(!user.emailVerifiedAt)throw new HttpError(409,'Vérifiez votre adresse avant la relance.');
  const event=await tx.shopWebhookEvent.findUnique({where:{id:input.eventId}});
  if(!event||event.shopId!==shopId||event.ownerId!==userId)throw new HttpError(404,'Événement introuvable');
  const previous=await tx.backgroundJob.findUnique({where:{dedupKey:'webhook-event:'+event.id+':'+input.requestId},select:{id:true,kind:true,subjectKey:true}});
  if(previous?.kind==='BUSINESS_WEBHOOK'&&previous.subjectKey===webhookSubject(shopId))return {alreadyApplied:true};
  if(!webhookEventFresh(event.createdAt)||event.deliveryCount>=WEBHOOK_MAX_DELIVERIES)
   throw new HttpError(409,'Cet événement est expiré ou a atteint sa limite de relances.');
  try{readWebhookEvent(event);}catch{throw new HttpError(409,'Le contenu de cet événement n’est plus disponible.');}
  const last=event.lastJobId?await tx.backgroundJob.findFirst({where:{id:event.lastJobId,kind:'BUSINESS_WEBHOOK',subjectKey:webhookSubject(shopId)},select:{status:true}}):null;
  if(!last||!['FAILED','CANCELLED'].includes(last.status))throw new HttpError(409,'Cet événement est déjà en cours ou accepté.');
  if(!await reserveWebhookBudget(tx,shopId,false))throw new HttpError(429,'La limite quotidienne d’envois externes est atteinte.');
  const job=await queueWebhookDelivery(tx,shopId,event.id,row.version,input.requestId);
  await tx.shopWebhookEvent.update({where:{id:event.id},data:{lastJobId:job.id,deliveryCount:{increment:1}}});
  return {alreadyApplied:false};
 },{timeout:15000});
 return {...await readWebhookSettings(userId,shopId),...outcome,...(revealed?{secret:revealed}:{})};
}
