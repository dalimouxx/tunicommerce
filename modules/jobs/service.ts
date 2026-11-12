import {randomUUID} from 'node:crypto';
import {Prisma,type BackgroundJob} from '@prisma/client';
import {prisma} from '../storage/client';
import {seal,open} from '../security/envelope';

export async function enqueueJob(tx:Prisma.TransactionClient,input:{kind:string;subjectKey:string;dedupKey:string;payload:unknown}){
 const id=randomUUID();
 return tx.backgroundJob.create({data:{id,kind:input.kind,subjectKey:input.subjectKey,dedupKey:input.dedupKey,
  payload:seal(input.payload,'job:'+id)}});
}
/** Leases and SKIP LOCKED permit concurrent workers without holding a DB transaction during network I/O. */
export async function leaseNextJob(kinds?:readonly string[]){
 const now=new Date(),leaseId=randomUUID(),lockedUntil=new Date(now.getTime()+90000);
 await prisma.$executeRaw`UPDATE "BackgroundJob" SET "status"='FAILED',"finishedAt"=${now},
  "errorCode"='LEASE_EXPIRED',"payload"=NULL,"leaseId"=NULL,"lockedUntil"=NULL
  WHERE "status"='PROCESSING' AND "lockedUntil"<=${now} AND "attempts">="maxAttempts"`;
 if(kinds?.length===0)return null;
 const rows=await prisma.$queryRaw<BackgroundJob[]>`
  UPDATE "BackgroundJob" AS j SET "status"='PROCESSING',"leaseId"=${leaseId},
   "lockedUntil"=${lockedUntil},"attempts"=j."attempts"+1
  WHERE j."id"=(SELECT "id" FROM "BackgroundJob"
   WHERE (("status"='PENDING' AND "availableAt"<=${now}) OR
    ("status"='PROCESSING' AND "lockedUntil"<=${now})) AND "attempts"<"maxAttempts"
   ${kinds?Prisma.sql`AND "kind" IN (${Prisma.join([...kinds])})`:Prisma.empty}
   ORDER BY "availableAt","createdAt","id" LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING j.*`;
 return rows[0]||null;
}
export async function finishJob(job:BackgroundJob,errorCode?:'DELIVERY_FAILED'|'INVALID_PAYLOAD'|'EXPIRED'|'UNSUPPORTED_KIND'|'CONFIGURATION_MISSING'|'WEBHOOK_REJECTED'){
 const now=new Date();
 const permanent=errorCode&&errorCode!=='DELIVERY_FAILED';
 const terminal=!errorCode||permanent||job.attempts>=job.maxAttempts;
 const saved=await prisma.backgroundJob.updateMany({
  where:{id:job.id,status:'PROCESSING',leaseId:job.leaseId,lockedUntil:{gt:now}},
  data:{status:errorCode?(terminal?'FAILED':'PENDING'):'SUCCEEDED',errorCode:errorCode||null,
   leaseId:null,lockedUntil:null,finishedAt:terminal?now:null,
   ...(terminal?{payload:null}:{}),
   availableAt:errorCode?new Date(now.getTime()+Math.min(3600000,15000*2**(job.attempts-1))):now}
 });
 return saved.count===1;
}
export function readJobPayload(job:BackgroundJob){
 if(!job.payload)throw Error('Contenu de tâche absent');
 return open(job.payload,'job:'+job.id);
}
