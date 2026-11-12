import type {Prisma,BackgroundJob} from '@prisma/client';
import type {z} from 'zod';
import {prisma} from '../storage/client';
import {homeOwner} from '../shops/home-service';
import {HttpError,applicationOrigin} from '../auth/http';
import {emailConfigured,sendAccountEmail} from './email';
import {encryptionConfigured} from '../security/envelope';
import {enqueueJob,readJobPayload,finishJob} from '../jobs/service';
import type {State} from '../commerce/types';
import {changeOrderMail,orderMailTemplates,defaultOrderMailTemplates,orderMailChanges,renderOrderMail,orderMailPayload} from './order-mail';
import {createHash} from 'node:crypto';

const key=(shopId:string)=>'shop-order:'+shopId;
export async function readOrderMail(userId:string,shopId:string){
 const shop=await homeOwner(userId,shopId);
 const [row,user,jobs]=await Promise.all([
  prisma.shopOrderMail.findUnique({where:{shopId}}),
  prisma.user.findUniqueOrThrow({where:{id:userId},select:{email:true,emailVerifiedAt:true}}),
  prisma.backgroundJob.findMany({where:{kind:'ORDER_EMAIL',subjectKey:key(shopId)},take:30,
   orderBy:[{createdAt:'desc'},{id:'desc'}],select:{id:true,status:true,attempts:true,maxAttempts:true,errorCode:true,createdAt:true,finishedAt:true}})
 ]);
 return {shopName:shop.name,enabled:row?.enabled??false,version:row?.version??0,
  templates:row?orderMailTemplates.parse(row.templates):defaultOrderMailTemplates,
  recipient:user.email,verified:!!user.emailVerifiedAt,configured:emailConfigured(),jobs};
}
export async function saveOrderMail(userId:string,shopId:string,input:z.infer<typeof changeOrderMail>){
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;
  await homeOwner(userId,shopId,tx);
  const [row,user]=await Promise.all([
   tx.shopOrderMail.findUnique({where:{shopId}}),
   tx.user.findUniqueOrThrow({where:{id:userId},select:{emailVerifiedAt:true}})
  ]);
  if((row?.version??0)!==input.expectedVersion)throw new HttpError(409,'Les réglages ont changé. Rechargez avant de réessayer.');
  if(input.enabled&&!emailConfigured())throw new HttpError(503,'Le service e-mail n’est pas configuré.');
  if(input.enabled&&!user.emailVerifiedAt)throw new HttpError(409,'Vérifiez votre adresse e-mail dans la sécurité du compte avant d’activer les alertes.');
  const data={enabled:input.enabled,templates:input.templates,version:(row?.version??0)+1};
  await tx.shopOrderMail.upsert({where:{shopId},create:{shopId,...data},update:data});
  if(!input.enabled)await tx.backgroundJob.updateMany({where:{kind:'ORDER_EMAIL',subjectKey:key(shopId),status:'PENDING'},
   data:{status:'CANCELLED',payload:null,finishedAt:new Date(),errorCode:null}});
 });
 return readOrderMail(userId,shopId);
}

/** Called after a successful commerce CAS, inside the same owner-locked transaction. */
export async function enqueueOrderMail(tx:Prisma.TransactionClient,scope:{shopId:string}|{workspaceId:string;ownerId:string},before:State,after:State,version:number){
 const changes=orderMailChanges(before,after);if(!changes.length)return;
 const shop=await tx.shop.findUnique({where:'shopId' in scope?{id:scope.shopId}:{legacyWorkspaceId:scope.workspaceId},
  select:{id:true,name:true,legacyWorkspaceId:true,legacyWorkspace:{select:{ownerId:true}},orderMail:true,
   organization:{select:{ownerId:true,owner:{select:{email:true,emailVerifiedAt:true}}}}}});
 if(!shop?.orderMail?.enabled)return;
 const ownerId=shop.organization.ownerId,owner=shop.organization.owner;
 if(shop.legacyWorkspaceId&&shop.legacyWorkspace?.ownerId!==ownerId||'ownerId' in scope&&scope.ownerId!==ownerId)return;
 const member=await tx.membership.findUnique({where:{shopId_userId:{shopId:shop.id,userId:ownerId}},select:{active:true,role:true}});
 if(!member?.active||member.role!=='OWNER'||!owner.emailVerifiedAt)return;
 const templates=orderMailTemplates.safeParse(shop.orderMail.templates);
 for(const change of changes){
  const dedupKey='order-mail:'+createHash('sha256').update([shop.id,change.orderId,version,change.event].join(':')).digest('hex');
  // An absent encryption key must not prevent a customer from ordering.
  if(!templates.success||!encryptionConfigured()){
   await tx.backgroundJob.create({data:{kind:'ORDER_EMAIL',subjectKey:key(shop.id),dedupKey,status:'FAILED',
    finishedAt:new Date(),errorCode:'CONFIGURATION_MISSING',payload:null}});continue;
  }
  const at=new Date().toISOString();
  const mail=renderOrderMail(templates.data[change.event],{...change,shopName:shop.name,at,
   url:applicationOrigin()+'/mes-boutiques/'+encodeURIComponent(shop.id)});
  await enqueueJob(tx,{kind:'ORDER_EMAIL',subjectKey:key(shop.id),dedupKey,
   payload:{shopId:shop.id,ownerId,email:owner.email,at,...mail}});
 }
}

export async function processOrderMail(job:BackgroundJob,send:typeof sendAccountEmail){
 let payload:z.infer<typeof orderMailPayload>;
 try{payload=orderMailPayload.parse(readJobPayload(job));}
 catch{await finishJob(job,'INVALID_PAYLOAD');return;}
 const age=Date.now()-Date.parse(payload.at);
 if(age< -60_000||age>48*3600_000||job.subjectKey!==key(payload.shopId)){
  await finishJob(job,'EXPIRED');return;
 }
 const shop=await prisma.shop.findUnique({where:{id:payload.shopId},select:{orderMail:{select:{enabled:true}},
  legacyWorkspaceId:true,legacyWorkspace:{select:{ownerId:true}},
  organization:{select:{ownerId:true,owner:{select:{email:true,emailVerifiedAt:true}}}},
  memberships:{where:{userId:payload.ownerId,active:true,role:'OWNER'},select:{id:true}}}});
 if(!shop?.orderMail?.enabled||shop.organization.ownerId!==payload.ownerId||!shop.memberships.length||
  !shop.organization.owner.emailVerifiedAt||shop.organization.owner.email!==payload.email||
  shop.legacyWorkspaceId&&shop.legacyWorkspace?.ownerId!==payload.ownerId){
  await finishJob(job,'EXPIRED');return;
 }
 try{await send({id:job.id,to:payload.email,subject:payload.subject,text:payload.text});await finishJob(job);}
 catch{await finishJob(job,'DELIVERY_FAILED');}
}
