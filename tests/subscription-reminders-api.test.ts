import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {Prisma} from '@prisma/client';
import {stopTestServer} from './server-process';
import {initialState} from '../modules/commerce/seed';
import {portalSessionHash} from '../modules/auth/portal';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||database!==process.env.DATABASE_URL)
 throw Error('Subscription reminders require matching disposable *_test databases');
const origin='https://subscription.example.test',base='http://127.0.0.1:3211',path='/api/auth/account/subscription-reminders',mark=randomUUID().slice(0,8);
process.env.APP_URL=origin;process.env.APP_ENCRYPTION_SECRET=randomBytes(40).toString('hex');
process.env.SMTP_HOST='smtp.example.test';process.env.SMTP_USER='fixture';process.env.SMTP_PASSWORD='fixture';
process.env.SMTP_PORT='587';process.env.MAIL_FROM='billing@example.test';
const {prisma}=await import('../modules/storage/client');
const {scheduleSubscriptionReminders,saveSubscriptionReminders}=await import('../modules/billing/reminders');
const {processOneJob}=await import('../modules/jobs/worker');
const {readJobPayload}=await import('../modules/jobs/service');
let server:ChildProcess|undefined,userId='',otherId='',staffId='',workspaceId='',cookie='',otherCookie='',staffCookie='';
const subject=()=> 'subscription:'+workspaceId;
const get=(session=cookie)=>fetch(base+path,{headers:{cookie:session},redirect:'manual'});
const put=(body:unknown,session=cookie,from=origin)=>fetch(base+path,{method:'PUT',headers:{cookie:session,origin:from,'content-type':'application/json'},body:JSON.stringify(body),redirect:'manual'});
async function session(userId:string){const token=randomBytes(32).toString('hex');await prisma.session.create({data:{tokenHash:portalSessionHash(token,'MERCHANT'),userId,expiresAt:new Date(Date.now()+3600000)}});return '__Host-tunicommerce='+token;}
async function drain(fail=false){const sent:{id:string;to:string;subject:string;text:string}[]=[];
 for(let i=0;i<20;i++){if(!await processOneJob(async message=>{if(fail)throw Error('simulated transport failure');sent.push(message);},{kinds:['SUBSCRIPTION_EMAIL']}))break;}return sent;}
async function cycle(offset:number){await prisma.workspace.update({where:{id:workspaceId},data:{subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+offset)}});await scheduleSubscriptionReminders();}

test('Subscription reminders: opt-in, private settings, bounded scheduler and renewal rechecks',async t=>{
 try{
  await prisma.backgroundJob.deleteMany();
  const data=initialState(false) as unknown as Prisma.InputJsonValue;
  const owner=await prisma.user.create({data:{email:'reminder-'+mark+'@example.test',name:'Reminder fixture',passwordHash:'not-a-login-password',workspace:{create:{data,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+3*86400000)}}},include:{workspace:true}});
  userId=owner.id;workspaceId=owner.workspace!.id;
  otherId=(await prisma.user.create({data:{email:'reminder-other-'+mark+'@example.test',name:'Other fixture',passwordHash:'not-a-login-password',workspace:{create:{data}}}})).id;
  staffId=(await prisma.user.create({data:{email:'reminder-staff-'+mark+'@example.test',name:'Staff fixture',passwordHash:'not-a-login-password'}})).id;
  cookie=await session(userId);otherCookie=await session(otherId);staffCookie=await session(staffId);
  server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3211'},stdio:'ignore'});
  let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('Server exited');try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await pause(250);}assert.ok(ready);
  await t.test('Settings are disabled by default and scoped to the authenticated account',async()=>{
   assert.equal((await get('')).status,401);assert.equal((await get(staffCookie)).status,404);
   const response=await get();assert.equal(response.status,200);assert.ok(response.headers.get('cache-control')?.includes('no-store'));
   assert.equal(response.headers.get('referrer-policy'),'no-referrer');
   const settings=await response.json();assert.equal(settings.enabled,false);assert.equal(settings.version,0);assert.equal(settings.verified,false);
   assert.equal((await (await get(otherCookie)).json()).recipient,'reminder-other-'+mark+'@example.test');
   assert.equal((await put({enabled:true,expectedVersion:0},cookie,'https://evil.example')).status,403);
   assert.equal((await put({enabled:true,expectedVersion:0,recipient:'other@example.test'})).status,400);
   assert.equal((await put({enabled:true,expectedVersion:0})).status,409);
   assert.equal((await scheduleSubscriptionReminders()).queued,0);
   await prisma.user.update({where:{id:userId},data:{emailVerifiedAt:new Date()}});
   const responses=await Promise.all([put({enabled:true,expectedVersion:0}),put({enabled:true,expectedVersion:0})]);
   assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
   const html=await (await fetch(base+'/mon-abonnement',{headers:{cookie}})).text();assert.ok(html.includes('Rappels d’abonnement'));
  });
  await t.test('Concurrent scheduling queues one encrypted reminder and never changes subscription rights',async()=>{
   const before=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceId}});
   const results=await Promise.all([scheduleSubscriptionReminders(),scheduleSubscriptionReminders()]);assert.equal(results.reduce((n,r)=>n+r.queued,0),1);
   const job=await prisma.backgroundJob.findFirstOrThrow({where:{subjectKey:subject()}});
   assert.equal(job.payload!.includes(owner.email),false);const payload=readJobPayload(job) as {kind:string};assert.equal(payload.kind,'DUE_7');
   const sent=await drain();assert.equal(sent.length,1);assert.equal(sent[0].to,owner.email);assert.ok(sent[0].text.includes(origin+'/mon-abonnement'));
   const after=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceId}});assert.equal(after.subscriptionStatus,before.subscriptionStatus);assert.deepEqual(after.subscriptionEndsAt,before.subscriptionEndsAt);
   assert.equal((await scheduleSubscriptionReminders()).queued,0);
   const saved=await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}});assert.equal(saved.status,'SUCCEEDED');assert.equal(saved.payload,null);
  });
  await t.test('Last-day and expired phases deliver only within their current window',async()=>{
   await cycle(12*3600000);assert.equal((await drain()).length,1);
   await cycle(-3600000);const sent=await drain();assert.equal(sent.length,1);assert.ok(sent[0].subject.includes('arrivé à échéance'));
   await cycle(-2*86400000);assert.equal((await drain()).length,0);
   await cycle(30*86400000);assert.equal((await drain()).length,0);
  });
  await t.test('Renewal, suspension, changed recipient, plan or verification cancel obsolete delivery',async()=>{
   const variants=[{subscriptionEndsAt:new Date(Date.now()+30*86400000)},{subscriptionStatus:'SUSPENDED'},{plan:'PRO'}];
   for(const variant of variants){await cycle(2*86400000);await prisma.workspace.update({where:{id:workspaceId},data:variant});assert.equal((await drain()).length,0);}
   await cycle(2*86400000);await prisma.user.update({where:{id:userId},data:{email:'changed-'+mark+'@example.test'}});assert.equal((await drain()).length,0);
   await prisma.user.update({where:{id:userId},data:{email:owner.email}});
   await cycle(2*86400000);await prisma.user.update({where:{id:userId},data:{emailVerifiedAt:null}});assert.equal((await drain()).length,0);
   assert.equal((await scheduleSubscriptionReminders()).queued,0);await prisma.user.update({where:{id:userId},data:{emailVerifiedAt:new Date()}});
  });
  await t.test('Disabling cancels pending payloads and never replays a phase on reactivation',async()=>{
   await cycle(2*86400000);const current=await (await get()).json();
   assert.equal((await put({enabled:false,expectedVersion:current.version})).status,200);
   assert.equal(await prisma.backgroundJob.count({where:{subjectKey:subject(),status:'PENDING'}}),0);
   assert.equal((await drain()).length,0);
   const changed=await (await get()).json();assert.equal((await put({enabled:true,expectedVersion:changed.version})).status,200);
   assert.equal((await scheduleSubscriptionReminders()).queued,0);
   const journal=await (await get()).json();assert.ok(journal.jobs.length>0);
   for(const job of journal.jobs){assert.equal('payload' in job,false);assert.equal('dedupKey' in job,false);assert.equal('subjectKey' in job,false);}
   assert.equal((await (await get(otherCookie)).json()).jobs.length,0);
  });
  await t.test('Temporary failures retry with one stable job identity; no unconfigured-channel attempts',async()=>{
   await cycle(3*86400000);await drain(true);
   const job=await prisma.backgroundJob.findFirstOrThrow({where:{subjectKey:subject(),status:'PENDING'}});assert.equal(job.attempts,1);
   assert.equal(await processOneJob(async()=>{throw Error('Must not send');},{kinds:[]}),false);
   assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}})).attempts,1);
   await prisma.backgroundJob.update({where:{id:job.id},data:{availableAt:new Date(0)}});
   const sent=await drain();assert.equal(sent.length,1);assert.equal(sent[0].id,job.id);
   const smtp=process.env.SMTP_HOST;delete process.env.SMTP_HOST;
   assert.equal((await scheduleSubscriptionReminders()).queued,0);
   await assert.rejects(saveSubscriptionReminders(userId,{enabled:true,expectedVersion:(await (await get()).json()).version}),{status:503});
   process.env.SMTP_HOST=smtp;
  });
  await t.test('Cursor passes are bounded to one hundred and do not strand the final account',async()=>{
   await prisma.workspace.update({where:{id:workspaceId},data:{subscriptionMailEnabled:false}});
   const users=Array.from({length:101},(_,i)=>({id:randomUUID(),email:'reminder-page-'+mark+'-'+i+'@example.test',name:'Paged fixture',passwordHash:'not-a-login-password',emailVerifiedAt:new Date()}));
   const workspaces=users.map(user=>({id:randomUUID(),ownerId:user.id,data,subscriptionMailEnabled:true,subscriptionStatus:'TRIAL',subscriptionEndsAt:new Date(Date.now()+2*86400000)}));
   try{
    await prisma.user.createMany({data:users});await prisma.workspace.createMany({data:workspaces});
    const first=await scheduleSubscriptionReminders();assert.equal(first.scanned,100);assert.equal(first.queued,100);assert.ok(first.nextCursor);
    const last=await scheduleSubscriptionReminders(new Date(),first.nextCursor!);assert.equal(last.scanned,1);assert.equal(last.queued,1);assert.equal(last.nextCursor,null);
    assert.equal((await scheduleSubscriptionReminders()).queued,0);
   }finally{
    await prisma.backgroundJob.deleteMany({where:{subjectKey:{in:workspaces.map(row=>'subscription:'+row.id)}}});
    await prisma.user.deleteMany({where:{id:{in:users.map(row=>row.id)}}});
   }
  });
 }finally{
  if(server)await stopTestServer(server);
  if(workspaceId)await prisma.backgroundJob.deleteMany({where:{subjectKey:subject()}});
  await prisma.user.deleteMany({where:{id:{in:[userId,otherId,staffId].filter(Boolean)}}});await prisma.$disconnect();
 }
});
