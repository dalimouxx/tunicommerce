import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {Prisma} from '@prisma/client';
import {stopTestServer} from './server-process';
import {initialState} from '../modules/commerce/seed';
import type {State} from '../modules/commerce/types';
import type {BusinessWebhookMessage} from '../modules/messaging/webhook-transport';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)throw Error('Webhooks require matching disposable *_test PostgreSQL databases');
const mark=randomUUID().slice(0,8),slug='hooks-'+mark,plan='HOOKS_'+mark,password='Webhook-Fixture-2026!';
const origin='https://webhooks.example.test',base='http://127.0.0.1:3209',destination='https://hooks.example.com/orders';
process.env.APP_URL=origin;process.env.APP_ENCRYPTION_SECRET=randomBytes(40).toString('hex');
process.env.WEBHOOK_ALLOWED_HOSTS='hooks.example.com';process.env.SMTP_HOST='';
const {prisma}=await import('../modules/storage/client');
const {hashPassword}=await import('../modules/auth/crypto');
const {processOneJob}=await import('../modules/jobs/worker');
const {enqueueJob,leaseNextJob,readJobPayload}=await import('../modules/jobs/service');
const {applyWebhookAction}=await import('../modules/messaging/webhook-service');
const {enqueueBusinessWebhooks,processBusinessWebhook}=await import('../modules/messaging/webhook-outbox');
const {readWebhookEvent,queueWebhookDelivery}=await import('../modules/messaging/webhook-store');
const {WebhookRejected}=await import('../modules/messaging/webhook-transport');
const {maintainJobs}=await import('../modules/jobs/operations');
const {seal}=await import('../modules/security/envelope');
const {writeIsolatedCommerce}=await import('../modules/shops/aggregate-quotas');
const {createPublicCodOrder}=await import('../modules/shops/public-cod-checkout');
const {createLegacyPublicOrder}=await import('../modules/shops/legacy-public-checkout');
const {mutateLegacyCommerce}=await import('../modules/shops/legacy-safe-writes');
let server:ChildProcess|undefined,ownerId='',otherId='',adminId='',org='',otherOrg='',shopId='',legacyShop='',otherShop='',cookie='',otherCookie='',adminCookie='',version=0,keyOne='';
const get=(path:string,session='')=>fetch(base+path,{headers:{cookie:session},redirect:'manual'});
const post=(path:string,body:unknown,session=cookie,from=origin)=>fetch(base+path,{method:'POST',headers:{cookie:session,origin:from,'content-type':'application/json'},body:JSON.stringify(body),redirect:'manual'});
const api=(id=shopId)=>'/api/v1/shops/'+id+'/webhook';
async function action(body:Record<string,unknown>,id=shopId,session=cookie,expectedVersion=version){
 const response=await post(api(id),{...body,expectedVersion},session),data=await response.json();
 if(response.ok&&id===shopId)version=data.version;return {status:response.status,data,headers:response.headers};
}
const save=(enabled:boolean)=>action({action:'save',endpoint:destination,enabled});
const createPayload=(phone='22123456')=>({name:'CLIENT-PRIVE',phone,city:'Tunis',address:'ADRESSE-PRIVEE',source:'Manuel',notes:'NOTE-PRIVEE',items:[{productId:'p1',quantity:1}]});
const mutate=(name:string,payload:unknown,requestId=randomUUID())=>writeIsolatedCommerce(ownerId,shopId,{action:name,payload,requestId},()=>{});
const one=(send:(input:BusinessWebhookMessage)=>Promise<void>)=>processOneJob(async()=>{throw Error('Unexpected e-mail');},{kinds:['BUSINESS_WEBHOOK'],sendWebhook:send});
async function drain(){const messages:BusinessWebhookMessage[]=[];for(let i=0;i<100;i++){if(!await one(async input=>{messages.push(input);}))break;}return messages;}
async function newEvent(){
 const ids=(await prisma.shopWebhookEvent.findMany({where:{shopId},select:{id:true}})).map(row=>row.id);
 const requestId=randomUUID(),result=await mutate('createOrder',createPayload(),requestId);
 const event=await prisma.shopWebhookEvent.findFirstOrThrow({where:{shopId,id:{notIn:ids}}});return {event,order:result.state.orders[0],requestId};
}

test('Signed business events: opt-in, encrypted outbox, isolation and bounded redelivery',async t=>{
 try{
  await prisma.backgroundJob.deleteMany();
  await prisma.subscriptionPlan.create({data:{code:plan,name:'Webhook fixture'}});
  const state=initialState(false);state.products=[{id:'p1',sku:'HOOK',name:'Produit fictif',category:'Test',variant:'',price:1001,cost:500,stock:100,threshold:1,color:'#abcdef',active:true}];
  const data=state as unknown as Prisma.InputJsonValue,passwordHash=await hashPassword(password),ends=new Date(Date.now()+86400000);
  const owner=await prisma.user.create({data:{email:slug+'@example.test',name:'Webhook owner',passwordHash,workspace:{create:{plan,data,slug:slug+'-legacy',published:true,subscriptionStatus:'ACTIVE',subscriptionEndsAt:ends}}},include:{workspace:true}});ownerId=owner.id;
  otherId=(await prisma.user.create({data:{email:slug+'-other@example.test',name:'Other webhook owner',passwordHash,emailVerifiedAt:new Date(),workspace:{create:{plan,data:initialState(false) as unknown as Prisma.InputJsonValue,subscriptionStatus:'ACTIVE',subscriptionEndsAt:ends}}}})).id;
  adminId=(await prisma.user.create({data:{email:slug+'-admin@example.test',name:'Platform fixture',role:'ADMIN',passwordHash}})).id;
  org=(await prisma.organization.create({data:{ownerId,name:'Webhook org'}})).id;
  otherOrg=(await prisma.organization.create({data:{ownerId:otherId,name:'Other webhook org'}})).id;
  shopId=(await prisma.shop.create({data:{organizationId:org,name:'Webhook fixture',slug,status:'PUBLISHED',commerce:{create:{data}},memberships:{create:{userId:ownerId,role:'OWNER'}}}})).id;
  legacyShop=(await prisma.shop.create({data:{organizationId:org,name:'Legacy webhook fixture',slug:slug+'-linked',legacyWorkspaceId:owner.workspace!.id,memberships:{create:{userId:ownerId,role:'OWNER'}}}})).id;
  otherShop=(await prisma.shop.create({data:{organizationId:otherOrg,name:'Other fixture',slug:slug+'-other',commerce:{create:{data}},memberships:{create:{userId:otherId,role:'OWNER'}}}})).id;
  await prisma.membership.create({data:{shopId,userId:otherId,role:'OWNER'}});
  server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3209'},stdio:'ignore'});
  let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('App exited');try{if((await get('/api/health')).ok){ready=true;break;}}catch{}await pause(250);}assert.ok(ready);
  for(const [email,portal] of [[owner.email,'owner'],[slug+'-other@example.test','other'],[slug+'-admin@example.test','admin']] as const){
   const response=await post('/api/auth/'+(portal==='admin'?'admin':'merchant')+'/login',{email,password},'');assert.equal(response.status,200);
   const session=response.headers.get('set-cookie')!.split(';')[0];if(portal==='owner')cookie=session;else if(portal==='other')otherCookie=session;else adminCookie=session;
  }
  await t.test('Only the true owner can read settings or rotate; secrets are never returned by GET',async()=>{
   assert.equal((await get(api())).status,401);assert.equal((await post(api(),{action:'rotate',expectedVersion:0},'')).status,401);
   assert.equal((await get(api(),otherCookie)).status,403);assert.equal((await get(api(),adminCookie)).status,401);
   assert.equal((await post(api(),{action:'rotate',expectedVersion:0},cookie,'https://evil.example')).status,403);
   assert.equal((await get('/mes-boutiques/'+shopId+'/integrations',cookie)).status,200);
   assert.equal((await get('/mes-boutiques/'+shopId+'/integrations',otherCookie)).status,404);
   const initial=await (await get(api(),cookie)).json();assert.equal(initial.enabled,false);assert.equal(initial.keyConfigured,false);
   assert.equal((await save(false)).status,200);
   const rotated=await action({action:'rotate'});assert.equal(rotated.status,200);keyOne=rotated.data.secret;
   assert.match(keyOne,/^twh_[A-Za-z0-9_-]{43}$/);assert.equal(rotated.data.enabled,false);
   assert.ok(rotated.headers.get('cache-control')?.includes('no-store'));assert.equal(rotated.headers.get('referrer-policy'),'no-referrer');
   const row=await prisma.shopWebhook.findUniqueOrThrow({where:{shopId}}),view=await (await get(api(),cookie)).json();
   assert.equal(JSON.stringify(row).includes(destination),false);assert.equal(JSON.stringify(row).includes(keyOne),false);
   assert.equal('secret' in view,false);assert.equal('secretEnvelope' in view,false);assert.equal('endpointEnvelope' in view,false);
   assert.equal((await save(true)).status,409,'Unverified owner cannot enable exports');
   await prisma.user.update({where:{id:ownerId},data:{emailVerifiedAt:new Date()}});
   assert.equal((await save(true)).status,200);
   assert.equal((await action({action:'save',endpoint:destination,enabled:true},shopId,cookie,version-1)).status,409);
   assert.equal((await action({action:'save',endpoint:destination,enabled:true,ownerId:otherId})).status,400);
   assert.equal((await action({action:'save',endpoint:'https://attacker.example.net/hook',enabled:true})).status,403);
   for(const endpoint of ['http://hooks.example.com/','https://127.0.0.1/','https://hooks.example.com/?secret=x'])assert.equal((await action({action:'save',endpoint,enabled:false})).status,400);
  });
  let originalEventId='',originalReference='';
  await t.test('Order mutations atomically enqueue minimal events; request retries and notes do not duplicate',async()=>{
   const {event,order,requestId}=await newEvent();originalEventId=event.id;originalReference=order.reference;
   await mutate('createOrder',createPayload(),requestId);await mutate('note',{id:order.id,note:'NOTE-INTERNE'});
   assert.equal(await prisma.shopWebhookEvent.count({where:{shopId}}),1);
   const body=readWebhookEvent(event);assert.equal(body.data.reference,order.reference);assert.equal(body.data.totalMillimes,9001);
   for(const value of ['CLIENT-PRIVE','ADRESSE-PRIVEE','NOTE-PRIVEE','22123456','publicReceiptId','cost'])assert.equal(JSON.stringify(body).includes(value),false);
   assert.equal(event.body!.includes(originalReference),false);
   const job=await prisma.backgroundJob.findUniqueOrThrow({where:{id:event.lastJobId!}});
   assert.deepEqual(readJobPayload(job),{shopId,eventId:event.id,destinationVersion:version});
   await mutate('transition',{id:order.id,status:'CONFIRMED'});
   const sent=await drain();assert.equal(sent.length,2);assert.ok(sent.every(message=>message.secret===keyOne&&message.endpoint===destination));
   assert.equal(JSON.parse(sent[0].body).id,event.id);
   assert.ok((await prisma.backgroundJob.findMany({where:{subjectKey:'shop-webhook:'+shopId}})).every(j=>j.status==='SUCCEEDED'&&j.payload===null));
  });
  await t.test('A rollback leaves no event, task or consumed budget',async()=>{
   const before=await prisma.shopWebhookEvent.count(),jobs=await prisma.backgroundJob.count(),config=await prisma.shopWebhook.findUniqueOrThrow({where:{shopId}});
   const current=(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}})).data as unknown as State,after=structuredClone(current);
   after.orders.unshift({...structuredClone(current.orders[0]),id:randomUUID()});
   await assert.rejects(prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${ownerId}))`;
    await enqueueBusinessWebhooks(tx,{shopId},current,after,999);throw Error('rollback-fixture');
   }),/rollback-fixture/);
   assert.equal(await prisma.shopWebhookEvent.count(),before);assert.equal(await prisma.backgroundJob.count(),jobs);
   assert.deepEqual(await prisma.shopWebhook.findUniqueOrThrow({where:{shopId}}),config);
  });
  await t.test('Capability leasing never consumes an unconfigured e-mail channel and remains parameterized',async()=>{
   const account=await prisma.$transaction(tx=>enqueueJob(tx,{kind:'ACCOUNT_EMAIL',subjectKey:'webhook-cap-'+mark,dedupKey:randomUUID(),payload:{fixture:true}}));
   await newEvent();assert.equal(await one(async()=>{}),true);
   assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:account.id}})).attempts,0);
   assert.equal(await leaseNextJob([]),null);assert.equal(await leaseNextJob(["BUSINESS_WEBHOOK') OR 1=1 --"]),null);
   assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:account.id}})).status,'PENDING');
   await prisma.backgroundJob.delete({where:{id:account.id}});
  });
  await t.test('Transient failures retry with stable delivery id; manual relaunch is idempotent with stable event bytes',async()=>{
   const {event}=await newEvent(),attempts:BusinessWebhookMessage[]=[];
   const fail=async(message:BusinessWebhookMessage)=>{attempts.push(message);throw Error('Temporary fixture');};
   await one(fail);let job=await prisma.backgroundJob.findUniqueOrThrow({where:{id:event.lastJobId!}});
   assert.equal(job.status,'PENDING');assert.equal(job.attempts,1);assert.ok(job.payload);assert.ok(job.availableAt.getTime()>Date.now());
   assert.equal(await one(async()=>{throw Error('Early retry');}),false);
   await prisma.backgroundJob.update({where:{id:job.id},data:{availableAt:new Date(0),attempts:3}});await one(fail);
   job=await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}});assert.equal(job.status,'FAILED');assert.equal(job.payload,null);
   assert.equal(attempts[0].deliveryId,attempts[1].deliveryId);assert.equal(attempts[0].body,attempts[1].body);
   const requestId=randomUUID(),v=version;
   const results=await Promise.all([action({action:'retry',eventId:event.id,requestId},shopId,cookie,v),action({action:'retry',eventId:event.id,requestId},shopId,cookie,v)]);
   assert.ok(results.every(result=>result.status===200));assert.deepEqual(results.map(result=>result.data.alreadyApplied).sort(),[false,true]);
   assert.equal((await prisma.shopWebhookEvent.findUniqueOrThrow({where:{id:event.id}})).deliveryCount,2);
   const sent=await drain();assert.equal(sent.length,1);assert.equal(sent[0].body,attempts[0].body);assert.notEqual(sent[0].deliveryId,attempts[0].deliveryId);
   assert.equal((await action({action:'retry',eventId:event.id,requestId})).data.alreadyApplied,true);
   assert.equal((await action({action:'retry',eventId:event.id,requestId:randomUUID()})).status,409);
  });
  await t.test('Permanent rejection and manual delivery limits cannot create unbounded replays',async()=>{
   const {event}=await newEvent(),reject=async()=>{throw new WebhookRejected('Fixture rejection');};await one(reject);
   for(let i=2;i<=5;i++){assert.equal((await action({action:'retry',eventId:event.id,requestId:randomUUID()})).status,200);await one(reject);}
   const last=await prisma.shopWebhookEvent.findUniqueOrThrow({where:{id:event.id}});assert.equal(last.deliveryCount,5);
   const job=await prisma.backgroundJob.findUniqueOrThrow({where:{id:last.lastJobId!}});assert.equal(job.attempts,1);assert.equal(job.errorCode,'WEBHOOK_REJECTED');
   assert.equal((await action({action:'retry',eventId:event.id,requestId:randomUUID()})).status,409);
  });
  await t.test('Independent and legacy public retries plus legacy merchant writes enqueue once',async()=>{
   const rotated=await action({action:'rotate'},legacyShop,cookie,0);assert.equal(rotated.status,200);
   assert.equal((await action({action:'save',endpoint:'https://hooks.example.com/legacy',enabled:true},legacyShop,cookie,rotated.data.version)).status,200);
   const before=await prisma.shopWebhookEvent.count(),payload=createPayload('55123456');
   const input={requestId:randomUUID(),name:payload.name,phone:payload.phone,city:'Tunis' as const,address:payload.address,items:payload.items};
   await createPublicCodOrder(slug,input);await createPublicCodOrder(slug,input);
   const legacy={requestId:randomUUID(),customer:{name:payload.name,phone:'99123456',city:payload.city,address:payload.address},items:payload.items};
   await createLegacyPublicOrder(slug+'-legacy',legacy);await createLegacyPublicOrder(slug+'-legacy',legacy);
   const id=randomUUID();await mutateLegacyCommerce(ownerId,{action:'createOrder',payload:createPayload('99123456'),requestId:id});
   await mutateLegacyCommerce(ownerId,{action:'createOrder',payload:createPayload('99123456'),requestId:id});
   assert.equal(await prisma.shopWebhookEvent.count(),before+3);assert.equal((await drain()).length,3);
  });
  await t.test('A destination change invalidates a leased task; disabling and rotating cancel pending tasks',async()=>{
   const {event}=await newEvent(),leased=(await leaseNextJob(['BUSINESS_WEBHOOK']))!;assert.equal(leased.id,event.lastJobId);
   assert.equal((await save(true)).status,200);let sent=0;await processBusinessWebhook(leased,async()=>{sent++;});assert.equal(sent,0);
   assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:leased.id}})).errorCode,'EXPIRED');
   const next=await newEvent();assert.equal((await save(false)).status,200);
   assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:next.event.lastJobId!}})).status,'CANCELLED');
   assert.equal(await one(async()=>{sent++;}),false);assert.equal((await save(true)).status,200);
   assert.equal((await action({action:'retry',eventId:next.event.id,requestId:randomUUID()})).status,200);
   const key=await action({action:'rotate'});assert.equal(key.status,200);assert.notEqual(key.data.secret,keyOne);assert.equal(key.data.enabled,false);
   assert.equal(await one(async()=>{sent++;}),false);assert.equal(sent,0);
   assert.equal((await save(true)).status,200);keyOne=key.data.secret;
  });
  await t.test('Quota and missing encryption never prevent the underlying order from being stored',async()=>{
   const limited=await newEvent();await one(async()=>{throw new WebhookRejected('Fixture quota preparation');});
   await prisma.shopWebhook.update({where:{shopId},data:{budgetDay:new Date().toISOString().slice(0,10),budgetCount:1000}});
   assert.equal((await action({action:'retry',eventId:limited.event.id,requestId:randomUUID()})).status,429);
   assert.equal((await prisma.shopWebhookEvent.findUniqueOrThrow({where:{id:limited.event.id}})).deliveryCount,1);
   const count=await prisma.shopWebhookEvent.count(),orders=((await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}})).data as unknown as State).orders.length;
   await mutate('createOrder',createPayload());assert.equal(await prisma.shopWebhookEvent.count(),count);
   assert.equal(((await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}})).data as unknown as State).orders.length,orders+1);
   assert.equal((await prisma.shopWebhook.findUniqueOrThrow({where:{shopId}})).droppedCount,1);
   await prisma.shopWebhook.update({where:{shopId},data:{budgetCount:0}});
   const secret=process.env.APP_ENCRYPTION_SECRET;delete process.env.APP_ENCRYPTION_SECRET;
   try{await mutate('createOrder',createPayload());}finally{process.env.APP_ENCRYPTION_SECRET=secret;}
   assert.equal(await prisma.backgroundJob.count({where:{subjectKey:'shop-webhook:'+shopId,errorCode:'CONFIGURATION_MISSING',payload:null}}),1);
   assert.equal(await prisma.shopWebhookEvent.count({where:{shopId,body:null}}),1);
  });
  await t.test('Operator revocation is checked before delivery and cannot be bypassed by a saved preference',async()=>{
   const {event}=await newEvent(),hosts=process.env.WEBHOOK_ALLOWED_HOSTS;delete process.env.WEBHOOK_ALLOWED_HOSTS;
   let sent=0;
   try{
    await one(async()=>{sent++;});
    await assert.rejects(applyWebhookAction(ownerId,shopId,{action:'save',endpoint:destination,enabled:true,expectedVersion:version}),error=>error instanceof Error&&'status' in error&&error.status===503);
   }finally{process.env.WEBHOOK_ALLOWED_HOSTS=hosts;}
   assert.equal(sent,0);assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:event.lastJobId!}})).errorCode,'WEBHOOK_REJECTED');
  });
  await t.test('Expired event bodies cannot send or relaunch and retention removes old records',async()=>{
   const {event}=await newEvent(),body=readWebhookEvent(event),old=new Date(Date.now()-49*3600000);
   await prisma.shopWebhookEvent.update({where:{id:event.id},data:{createdAt:old,body:seal({...body,occurredAt:old.toISOString()},'webhook-event:'+event.id)}});
   let sent=0;await one(async()=>{sent++;});assert.equal(sent,0);
   assert.equal((await action({action:'retry',eventId:event.id,requestId:randomUUID()})).status,409);
   const expired=new Date(Date.now()-31*86400000);
   await prisma.shopWebhookEvent.update({where:{id:event.id},data:{createdAt:expired}});
   await prisma.backgroundJob.update({where:{id:event.lastJobId!},data:{finishedAt:expired}});
   const state=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),result=await maintainJobs();assert.ok(result.webhooks>=1);
   assert.equal(await prisma.shopWebhookEvent.count({where:{id:event.id}}),0);assert.deepEqual(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}}),state);
  });
  await t.test('Encrypted event bodies cannot be copied to another shop or recovered through its journal',async()=>{
   const key=await action({action:'rotate'},otherShop,otherCookie,0);assert.equal(key.status,200);
   const cfg=await action({action:'save',endpoint:'https://hooks.example.com/other',enabled:true},otherShop,otherCookie,key.data.version);assert.equal(cfg.status,200);
   const original=await prisma.shopWebhookEvent.findUniqueOrThrow({where:{id:originalEventId}});
   const event=await prisma.shopWebhookEvent.create({data:{shopId:otherShop,ownerId:otherId,kind:original.kind,body:original.body,createdAt:original.createdAt}});
   const job=await prisma.$transaction(tx=>queueWebhookDelivery(tx,otherShop,event.id,cfg.data.version,'initial'));
   await prisma.shopWebhookEvent.update({where:{id:event.id},data:{lastJobId:job.id}});
   let sent=0;await one(async()=>{sent++;});assert.equal(sent,0);
   assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}})).errorCode,'INVALID_PAYLOAD');
   const view=await (await get(api(otherShop),otherCookie)).json();assert.equal(JSON.stringify(view).includes(originalReference),false);
   assert.equal((await action({action:'retry',eventId:originalEventId,requestId:randomUUID()},otherShop,otherCookie,cfg.data.version)).status,404);
  });
  await t.test('Revocation and ownership changes do not inherit an old destination or disclose old events',async()=>{
   await newEvent();await prisma.membership.update({where:{shopId_userId:{shopId,userId:ownerId}},data:{active:false}});
   let sent=0;await one(async()=>{sent++;});assert.equal(sent,0);
   await prisma.membership.update({where:{shopId_userId:{shopId,userId:ownerId}},data:{active:true}});
   const {event}=await newEvent(),leased=(await leaseNextJob(['BUSINESS_WEBHOOK']))!;assert.equal(leased.id,event.lastJobId);
   await prisma.organization.update({where:{id:org},data:{ownerId:otherId}});
   await processBusinessWebhook(leased,async()=>{sent++;});assert.equal(sent,0);
   const view=await (await get(api(),otherCookie)).json();assert.equal(view.enabled,false);assert.equal(view.endpoint,'');assert.equal(view.keyConfigured,false);assert.equal(view.events.length,0);
   const before=await prisma.shopWebhookEvent.count();
   await writeIsolatedCommerce(otherId,shopId,{action:'createOrder',payload:createPayload(),requestId:randomUUID()},()=>{});
   assert.equal(await prisma.shopWebhookEvent.count(),before,'Former owner preference cannot export new owner data');
   const key=await action({action:'rotate'},shopId,otherCookie,view.version);assert.equal(key.status,200);assert.equal(key.data.endpoint,'');
   const cfg=await action({action:'save',endpoint:'https://hooks.example.com/new-owner',enabled:true},shopId,otherCookie,key.data.version);assert.equal(cfg.status,200);
   assert.equal((await action({action:'retry',eventId:originalEventId,requestId:randomUUID()},shopId,otherCookie,cfg.data.version)).status,404);
   assert.equal((await get(api(),cookie)).status,403);
   await writeIsolatedCommerce(otherId,shopId,{action:'createOrder',payload:createPayload(),requestId:randomUUID()},()=>{});
   const messages=await drain();assert.equal(messages.length,1);assert.equal(messages[0].endpoint,'https://hooks.example.com/new-owner');assert.equal(messages[0].secret,key.data.secret);
  });
 }finally{
  if(server&&server.exitCode===null){const exited=once(server,'exit');stopTestServer(server);await exited;}
  await prisma.backgroundJob.deleteMany({where:{OR:[{subjectKey:{in:[shopId,legacyShop,otherShop].filter(Boolean).map(id=>'shop-webhook:'+id)}},{subjectKey:'webhook-cap-'+mark}]}});
  await prisma.organization.deleteMany({where:{id:{in:[org,otherOrg].filter(Boolean)}}});
  await prisma.user.deleteMany({where:{id:{in:[ownerId,otherId,adminId].filter(Boolean)}}});
  await prisma.subscriptionPlan.deleteMany({where:{code:plan}});
  await prisma.$disconnect();
 }
});
