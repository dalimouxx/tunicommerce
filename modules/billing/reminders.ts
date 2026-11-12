import type {BackgroundJob,Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError,applicationOrigin} from '../auth/http';
import {emailConfigured,sendAccountEmail} from '../messaging/email';
import {enqueueJob,readJobPayload,finishJob} from '../jobs/service';
import {subscriptionReminderKind,subscriptionReminderMessage,subscriptionReminderPayload,subscriptionReminderChange} from './reminder-policy';
import type {z} from 'zod';

const subjectKey=(id:string)=>'subscription:'+id;
const accountSelect={id:true,ownerId:true,plan:true,subscriptionStatus:true,subscriptionEndsAt:true,
 subscriptionMailEnabled:true,subscriptionMailVersion:true,owner:{select:{email:true,emailVerifiedAt:true}}} satisfies Prisma.WorkspaceSelect;
export async function readSubscriptionReminders(userId:string){
 const row=await prisma.workspace.findUnique({where:{ownerId:userId},select:{id:true,subscriptionMailEnabled:true,subscriptionMailVersion:true,owner:{select:{email:true,emailVerifiedAt:true}}}});
 if(!row)throw new HttpError(404,'Compte marchand introuvable');
 const jobs=await prisma.backgroundJob.findMany({where:{kind:'SUBSCRIPTION_EMAIL',subjectKey:subjectKey(row.id)},
  orderBy:[{createdAt:'desc'},{id:'desc'}],take:20,select:{id:true,status:true,attempts:true,errorCode:true,createdAt:true,finishedAt:true}});
 return {enabled:row.subscriptionMailEnabled,version:row.subscriptionMailVersion,configured:emailConfigured(),verified:!!row.owner.emailVerifiedAt,recipient:row.owner.email,jobs};
}
export async function saveSubscriptionReminders(userId:string,input:z.infer<typeof subscriptionReminderChange>){
 await prisma.$transaction(async tx=>{
  const rows=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Workspace" WHERE "ownerId"=${userId} FOR UPDATE`;
  if(!rows[0])throw new HttpError(404,'Compte marchand introuvable');
  const row=await tx.workspace.findUniqueOrThrow({where:{id:rows[0].id},select:accountSelect});
  if(row.subscriptionMailVersion!==input.expectedVersion)throw new HttpError(409,'Les réglages ont changé. Actualisez leur état avant de réessayer.');
  if(input.enabled&&!emailConfigured())throw new HttpError(503,'Le service e-mail n’est pas encore configuré.');
  if(input.enabled&&!row.owner.emailVerifiedAt)throw new HttpError(409,'Vérifiez votre adresse e-mail avant d’activer les rappels.');
  await tx.workspace.update({where:{id:row.id},data:{subscriptionMailEnabled:input.enabled,subscriptionMailVersion:{increment:1}}});
  await tx.backgroundJob.updateMany({where:{kind:'SUBSCRIPTION_EMAIL',subjectKey:subjectKey(row.id),status:'PENDING'},
   data:{status:'CANCELLED',payload:null,finishedAt:new Date(),errorCode:null}});
 });
 return readSubscriptionReminders(userId);
}

/** Bounded cursor pass; concurrent workers serialize on each workspace. No external I/O. */
export async function scheduleSubscriptionReminders(now=new Date(),afterId?:string){
 if(!emailConfigured())return {scanned:0,queued:0,nextCursor:null as string|null};
 const rows=await prisma.workspace.findMany({where:{subscriptionMailEnabled:true,
  subscriptionStatus:{in:['ACTIVE','TRIAL']},subscriptionEndsAt:{gt:new Date(now.getTime()-86_400_000),lte:new Date(now.getTime()+7*86_400_000)},
  ...(afterId?{id:{gt:afterId}}:{})},orderBy:{id:'asc'},take:100,select:{id:true}});
 let queued=0;
 for(const {id} of rows){
  queued+=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id"=${id} FOR UPDATE`;
   const row=await tx.workspace.findUnique({where:{id},select:accountSelect});
   if(!row?.subscriptionMailEnabled||!row.owner.emailVerifiedAt||row.subscriptionMailVersion>=2147483647)return 0;
   const kind=subscriptionReminderKind(row.subscriptionStatus,row.subscriptionEndsAt,now);if(!kind)return 0;
   const endsAt=row.subscriptionEndsAt!.toISOString(),dedupKey=['subscription-mail',id,endsAt,kind].join(':');
   if(await tx.backgroundJob.findUnique({where:{dedupKey},select:{id:true}}))return 0;
   await enqueueJob(tx,{kind:'SUBSCRIPTION_EMAIL',subjectKey:subjectKey(id),dedupKey,
    payload:{workspaceId:id,ownerId:row.ownerId,email:row.owner.email,endsAt,plan:row.plan,kind,preferenceVersion:row.subscriptionMailVersion,at:now.toISOString()}});
   return 1;
  });
 }
 return {scanned:rows.length,queued,nextCursor:rows.length===100?rows.at(-1)!.id:null};
}

export async function processSubscriptionReminder(job:BackgroundJob,send:typeof sendAccountEmail){
 let payload:z.infer<typeof subscriptionReminderPayload>;
 try{payload=subscriptionReminderPayload.parse(readJobPayload(job));}catch{await finishJob(job,'INVALID_PAYLOAD');return;}
 const now=new Date(),age=now.getTime()-Date.parse(payload.at);
 if(job.subjectKey!==subjectKey(payload.workspaceId)||age< -60_000||age>48*3600_000){await finishJob(job,'EXPIRED');return;}
 const row=await prisma.workspace.findUnique({where:{id:payload.workspaceId},select:accountSelect});
 if(!row?.subscriptionMailEnabled||row.ownerId!==payload.ownerId||!row.owner.emailVerifiedAt||row.owner.email!==payload.email||
  row.subscriptionMailVersion!==payload.preferenceVersion||row.plan!==payload.plan||row.subscriptionEndsAt?.toISOString()!==payload.endsAt||
  subscriptionReminderKind(row.subscriptionStatus,row.subscriptionEndsAt,now)!==payload.kind){await finishJob(job,'EXPIRED');return;}
 try{
  await send({id:job.id,to:payload.email,...subscriptionReminderMessage(payload.kind,row.subscriptionEndsAt!,applicationOrigin())});
  await finishJob(job);
 }catch{await finishJob(job,'DELIVERY_FAILED');}
}
