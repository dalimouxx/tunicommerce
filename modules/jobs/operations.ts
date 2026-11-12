import {prisma} from '../storage/client';

export const WORKER_FRESH_MS=120_000;
export const JOB_RETENTION_DAYS=30;
export const SECURITY_RETENTION_DAYS=180;
const day=86_400_000;

export async function touchWorker(id:string,now=new Date()){
 return prisma.workerHeartbeat.upsert({where:{id},
  create:{id,startedAt:now,lastSeenAt:now},update:{lastSeenAt:now,stoppedAt:null}});
}
export async function stopWorker(id:string,now=new Date()){
 await prisma.workerHeartbeat.updateMany({where:{id},data:{lastSeenAt:now,stoppedAt:now}});
}
/** Bounded batches, safe to run from multiple workers. Never deletes live jobs. */
export async function maintainJobs(now=new Date()){
 const cutoff=new Date(now.getTime()-JOB_RETENTION_DAYS*day);
 const securityCutoff=new Date(now.getTime()-SECURITY_RETENTION_DAYS*day);
 const workerCutoff=new Date(now.getTime()-7*day);
 const expiredCutoff=new Date(now.getTime()-2*day);
 return prisma.$transaction(async tx=>{
  const expired=await tx.$executeRaw`WITH victims AS MATERIALIZED (
   SELECT "id" FROM "BackgroundJob" WHERE "status"='PENDING'
    AND "kind" IN ('ACCOUNT_EMAIL','ORDER_EMAIL','BUSINESS_WEBHOOK','SUBSCRIPTION_EMAIL') AND "createdAt"<${expiredCutoff}
    ORDER BY "createdAt","id" LIMIT 500 FOR UPDATE SKIP LOCKED)
   UPDATE "BackgroundJob" SET "status"='FAILED',"errorCode"='EXPIRED',"payload"=NULL,"finishedAt"=${now},"leaseId"=NULL,"lockedUntil"=NULL
    WHERE "id" IN (SELECT "id" FROM victims)`;
  const jobs=await tx.$executeRaw`WITH victims AS MATERIALIZED (
   SELECT "id" FROM "BackgroundJob" WHERE "status" IN ('SUCCEEDED','FAILED','CANCELLED')
    AND "finishedAt"<${cutoff} ORDER BY "finishedAt","id" LIMIT 500 FOR UPDATE SKIP LOCKED)
   DELETE FROM "BackgroundJob" WHERE "id" IN (SELECT "id" FROM victims)`;
  const tokens=await tx.$executeRaw`WITH victims AS MATERIALIZED (
   SELECT "tokenHash" FROM "AccountActionToken" WHERE "expiresAt"<${cutoff}
   ORDER BY "expiresAt","tokenHash" LIMIT 500 FOR UPDATE SKIP LOCKED)
   DELETE FROM "AccountActionToken" WHERE "tokenHash" IN (SELECT "tokenHash" FROM victims)`;
  const events=await tx.$executeRaw`WITH victims AS MATERIALIZED (
   SELECT "id" FROM "AccountSecurityEvent" WHERE "createdAt"<${securityCutoff}
   ORDER BY "createdAt","id" LIMIT 500 FOR UPDATE SKIP LOCKED)
   DELETE FROM "AccountSecurityEvent" WHERE "id" IN (SELECT "id" FROM victims)`;
  const workers=await tx.$executeRaw`WITH victims AS MATERIALIZED (
   SELECT "id" FROM "WorkerHeartbeat" WHERE "lastSeenAt"<${workerCutoff}
   ORDER BY "lastSeenAt","id" LIMIT 500 FOR UPDATE SKIP LOCKED)
   DELETE FROM "WorkerHeartbeat" WHERE "id" IN (SELECT "id" FROM victims)`;
  const webhooks=await tx.$executeRaw`WITH victims AS MATERIALIZED (
   SELECT "id" FROM "ShopWebhookEvent" WHERE "createdAt"<${cutoff}
   ORDER BY "createdAt","id" LIMIT 500 FOR UPDATE SKIP LOCKED)
   DELETE FROM "ShopWebhookEvent" WHERE "id" IN (SELECT "id" FROM victims)`;
  return {expired,jobs,tokens,events,workers,webhooks};
 });
}
/** Aggregate diagnostics only. No encrypted payload, recipient or process hostname. */
export async function readWorkerHealth(now=new Date()){
 const fresh=new Date(now.getTime()-WORKER_FRESH_MS);
 const [activeWorkers,last,pending,failed,expiredLeases,oldest]=await Promise.all([
  prisma.workerHeartbeat.count({where:{lastSeenAt:{gte:fresh},stoppedAt:null}}),
  prisma.workerHeartbeat.findFirst({orderBy:{lastSeenAt:'desc'},select:{lastSeenAt:true}}),
  prisma.backgroundJob.count({where:{status:{in:['PENDING','PROCESSING']}}}),
  prisma.backgroundJob.count({where:{status:'FAILED'}}),
  prisma.backgroundJob.count({where:{status:'PROCESSING',lockedUntil:{lte:now}}}),
  prisma.backgroundJob.findFirst({where:{status:'PENDING',availableAt:{lte:now}},orderBy:{createdAt:'asc'},select:{createdAt:true}})
 ]);
 return {activeWorkers,lastSeenAt:last?.lastSeenAt??null,pending,failed,expiredLeases,
  oldestReadySeconds:oldest?Math.max(0,Math.floor((now.getTime()-oldest.createdAt.getTime())/1000)):null};
}
