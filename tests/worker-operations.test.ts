import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)
 throw Error('Worker operations require matching disposable *_test PostgreSQL databases');
const {prisma}=await import('../modules/storage/client');
const {touchWorker,stopWorker,maintainJobs,readWorkerHealth}=await import('../modules/jobs/operations');
const now=new Date('2035-01-01T12:00:00Z'),day=86_400_000;
const ago=(days:number)=>new Date(now.getTime()-days*day);
test('Worker supervision and bounded retention',async t=>{
 const worker=randomUUID(),oldWorker=randomUUID(),prefix='operations-'+randomUUID();
 let userId='';
 try{
  await t.test('Fresh, stale and gracefully stopped workers are distinguished',async()=>{
   const baseline=await readWorkerHealth(now);
   await touchWorker(worker,new Date(now.getTime()-119_000));
   assert.equal((await readWorkerHealth(now)).activeWorkers,baseline.activeWorkers+1);
   assert.equal((await readWorkerHealth(new Date(now.getTime()+2000))).activeWorkers,baseline.activeWorkers);
   await touchWorker(worker,now);await stopWorker(worker,now);
   assert.equal((await readWorkerHealth(now)).activeWorkers,baseline.activeWorkers);
   await touchWorker(worker,now);
   assert.equal((await readWorkerHealth(now)).activeWorkers,baseline.activeWorkers+1);
  });
  const job=async(status:string,finishedAt:Date|null,extra={})=>prisma.backgroundJob.create({data:{
   kind:'FIXTURE',subjectKey:prefix,dedupKey:randomUUID(),status,finishedAt,createdAt:ago(60),...extra}});
  await t.test('Only old terminal jobs are purged; active, recent and undated rows survive',async()=>{
   const terminal=await Promise.all(['SUCCEEDED','FAILED','CANCELLED'].map(status=>job(status,ago(31))));
   const survivors=await Promise.all([
    job('PENDING',ago(60)),job('PROCESSING',ago(60),{lockedUntil:ago(1)}),
    job('FAILED',ago(30)),job('SUCCEEDED',null),job('CANCELLED',ago(1))
   ]);
   await maintainJobs(now);
   assert.equal(await prisma.backgroundJob.count({where:{id:{in:terminal.map(j=>j.id)}}}),0);
   assert.equal(await prisma.backgroundJob.count({where:{id:{in:survivors.map(j=>j.id)}}}),survivors.length);
   assert.equal((await readWorkerHealth(now)).expiredLeases>=1,true);
  });
  await t.test('Security events, expired tokens and stale workers have separate retention limits',async()=>{
   userId=(await prisma.user.create({data:{email:prefix+'@example.test',name:'Operations fixture',passwordHash:'not-a-real-password'}})).id;
   await prisma.accountSecurityEvent.createMany({data:[
    {id:prefix+'-old',userId,kind:'TEST',createdAt:ago(181)},
    {id:prefix+'-keep',userId,kind:'TEST',createdAt:ago(180)}]});
   await prisma.accountActionToken.createMany({data:[
    {userId,purpose:'OLD',email:'fixture@example.test',tokenHash:prefix+'-old',expiresAt:ago(31)},
    {userId,purpose:'RECENT',email:'fixture@example.test',tokenHash:prefix+'-keep',expiresAt:ago(30)}]});
   await touchWorker(oldWorker,ago(8));
   await maintainJobs(now);
   assert.deepEqual((await prisma.accountSecurityEvent.findMany({where:{userId}})).map(e=>e.id),[prefix+'-keep']);
   assert.deepEqual((await prisma.accountActionToken.findMany({where:{userId}})).map(e=>e.tokenHash),[prefix+'-keep']);
   assert.equal(await prisma.workerHeartbeat.count({where:{id:oldWorker}}),0);
   assert.equal(await prisma.workerHeartbeat.count({where:{id:worker}}),1);
  });
  await t.test('Concurrent maintenance is bounded and leaves pending jobs intact',async()=>{
   await prisma.backgroundJob.createMany({data:Array.from({length:1001},()=>({
    kind:'FIXTURE',subjectKey:prefix,dedupKey:randomUUID(),status:'SUCCEEDED',finishedAt:ago(31)}))});
   const result=await maintainJobs(now);assert.equal(result.jobs,500);
   await Promise.all([maintainJobs(now),maintainJobs(now)]);
   assert.equal(await prisma.backgroundJob.count({where:{subjectKey:prefix,status:'SUCCEEDED',finishedAt:{lt:ago(30)}}}),0);
   assert.equal(await prisma.backgroundJob.count({where:{subjectKey:prefix,status:'PENDING'}}),1);
  });
  await t.test('Expired known communications are failed without sending while recent and generic jobs survive',async()=>{
   const old=await Promise.all(['ACCOUNT_EMAIL','ORDER_EMAIL','BUSINESS_WEBHOOK'].map(kind=>job('PENDING',null,{kind,createdAt:ago(3),payload:'fixture-protected'})));
   const recent=await job('PENDING',null,{kind:'BUSINESS_WEBHOOK',createdAt:ago(1),payload:'fixture-protected'});
   const result=await maintainJobs(now);assert.ok(result.expired>=3);
   for(const row of await prisma.backgroundJob.findMany({where:{id:{in:old.map(j=>j.id)}}})){
    assert.equal(row.status,'FAILED');assert.equal(row.errorCode,'EXPIRED');assert.equal(row.payload,null);assert.deepEqual(row.finishedAt,now);
   }
   assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:recent.id}})).status,'PENDING');
   assert.equal(await prisma.backgroundJob.count({where:{subjectKey:prefix,status:'PENDING',kind:'FIXTURE'}}),1);
  });
 }finally{
  await prisma.backgroundJob.deleteMany({where:{subjectKey:prefix}});
  await prisma.workerHeartbeat.deleteMany({where:{id:{in:[worker,oldWorker]}}});
  if(userId)await prisma.user.delete({where:{id:userId}});
  await prisma.$disconnect();
 }
});
