import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {Prisma} from '@prisma/client';
import {stopTestServer} from './server-process';
import {defaultOrderMailTemplates} from '../modules/messaging/order-mail';
import {initialState} from '../modules/commerce/seed';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)
 throw Error('Order mail requires matching disposable *_test PostgreSQL databases');
const origin='https://order-mail.example.test',base='http://127.0.0.1:3207',mark=randomUUID().slice(0,8);
process.env.APP_URL=origin;process.env.APP_ENCRYPTION_SECRET=randomBytes(40).toString('hex');
process.env.SMTP_HOST='smtp.invalid.example';process.env.SMTP_USER='fixture';process.env.SMTP_PASSWORD='fixture';
process.env.SMTP_PORT='587';process.env.MAIL_FROM='security@example.test';
const {prisma}=await import('../modules/storage/client');
const {hashPassword}=await import('../modules/auth/crypto');
const {processOneJob}=await import('../modules/jobs/worker');
const {readJobPayload,enqueueJob}=await import('../modules/jobs/service');
const {enqueueOrderMail,saveOrderMail}=await import('../modules/messaging/order-mail-service');
const {writeIsolatedCommerce}=await import('../modules/shops/aggregate-quotas');
const {mutateLegacyCommerce}=await import('../modules/shops/legacy-safe-writes');
const {createLegacyPublicOrder}=await import('../modules/shops/legacy-public-checkout');
const {createPublicCodOrder}=await import('../modules/shops/public-cod-checkout');
const password='Order-Mail-Fixture-2026!',plan='MAIL_'+mark,slug='mail-'+mark;
let server:ChildProcess|undefined,ownerId='',otherId='',org='',otherOrg='',shopId='',legacyShop='',workspaceId='',cookie='',otherCookie='';
const get=(path:string,session='')=>fetch(base+path,{headers:{cookie:session},redirect:'manual'});
const put=(path:string,body:unknown,session=cookie,from=origin)=>fetch(base+path,{method:'PUT',headers:{cookie:session,origin:from,'content-type':'application/json'},body:JSON.stringify(body),redirect:'manual'});
const endpoint=()=>'/api/v1/shops/'+shopId+'/notifications';
const subject=()=> 'shop-order:'+shopId;
const input=(version:number,enabled=true)=>({expectedVersion:version,enabled,templates:defaultOrderMailTemplates});
const order=(phone='22123456')=>({name:'CLIENT-PRIVE',phone,city:'Tunis',address:'ADRESSE-PRIVEE',source:'Manuel',notes:'NOTE-PRIVEE',items:[{productId:'mail-product',quantity:1}]});
const mutate=(action:string,payload:unknown,requestId=randomUUID())=>writeIsolatedCommerce(ownerId,shopId,{action,payload,requestId},()=>{});
async function drain(){const sent:{id:string;to:string;subject:string;text:string}[]=[];
 for(let i=0;i<20;i++){if(!await processOneJob(async message=>{sent.push(message);}))break;}return sent;}

test('Owner order alerts: explicit settings, transactional outbox and private attempts',async t=>{
 try{
  await prisma.backgroundJob.deleteMany();
  await prisma.subscriptionPlan.create({data:{code:plan,name:'Mail fixture',enabled:true}});
  const state=initialState(false);state.products=[{id:'mail-product',name:'Fixture item',sku:'MAIL',category:'Test',variant:'',price:1001,cost:500,stock:100,threshold:1,color:'#000000',active:true}];
  const data=state as unknown as Prisma.InputJsonValue,passwordHash=await hashPassword(password);
  const owner=await prisma.user.create({data:{email:slug+'@example.test',name:'Mail owner',passwordHash,workspace:{create:{plan,data,published:true,slug:slug+'-legacy',subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)}}},include:{workspace:true}});
  ownerId=owner.id;workspaceId=owner.workspace!.id;
  otherId=(await prisma.user.create({data:{email:slug+'-other@example.test',name:'Other owner',passwordHash}})).id;
  org=(await prisma.organization.create({data:{ownerId,name:'Mail org'}})).id;
  otherOrg=(await prisma.organization.create({data:{ownerId:otherId,name:'Other mail org'}})).id;
  shopId=(await prisma.shop.create({data:{organizationId:org,name:'Mail shop',slug,status:'PUBLISHED',commerce:{create:{data}},memberships:{create:{userId:ownerId,role:'OWNER'}}}})).id;
  legacyShop=(await prisma.shop.create({data:{organizationId:org,name:'Legacy mail shop',slug:slug+'-linked',legacyWorkspaceId:workspaceId,memberships:{create:{userId:ownerId,role:'OWNER'}}}})).id;
  await prisma.membership.create({data:{shopId,userId:otherId,role:'ADMIN'}});
  server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3207'},stdio:'ignore'});
  let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('Application exited');try{if((await get('/api/health')).ok){ready=true;break;}}catch{}await pause(250);}assert.ok(ready);
  for(const [email,isOwner] of [[owner.email,true],[slug+'-other@example.test',false]] as const){
   const response=await fetch(base+'/api/auth/merchant/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email,password})});
   assert.equal(response.status,200);const session=response.headers.get('set-cookie')!.split(';')[0];if(isOwner)cookie=session;else otherCookie=session;
  }
  await t.test('Settings and private page are owner-only, opt-in and origin protected',async()=>{
   assert.equal((await get(endpoint())).status,401);assert.equal((await put(endpoint(),input(0),'')).status,401);
   assert.equal((await get(endpoint(),otherCookie)).status,403);
   await prisma.membership.update({where:{shopId_userId:{shopId,userId:otherId}},data:{role:'OWNER'}});
   assert.equal((await get(endpoint(),otherCookie)).status,403);
   assert.equal((await put(endpoint(),input(0),cookie,'https://evil.example')).status,403);
   assert.equal((await get('/mes-boutiques/'+shopId+'/notifications')).status,307);
   assert.equal((await get('/mes-boutiques/'+shopId+'/notifications',otherCookie)).status,404);
   const response=await get(endpoint(),cookie);assert.equal(response.status,200);assert.ok(response.headers.get('cache-control')?.includes('no-store'));
   assert.equal((await response.json()).enabled,false);
   assert.equal((await put(endpoint(),input(0))).status,409,'Unverified recipient cannot enable mail');
   assert.equal((await get('/mes-boutiques/'+shopId+'/notifications',cookie)).status,200);
  });
  await t.test('Concurrent settings reject stale writes; templates cannot change destination',async()=>{
   await prisma.user.update({where:{id:ownerId},data:{emailVerifiedAt:new Date()}});
   const results=await Promise.all([put(endpoint(),input(0)),put(endpoint(),input(0))]);
   assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
   assert.equal((await put(endpoint(),{...input(1),recipient:'attacker@example.test'})).status,400);
   assert.equal((await put(endpoint(),{...input(1),templates:{...defaultOrderMailTemplates,ORDER_CREATED:{subject:'Bad\r\nBcc: x',body:'x'}}})).status,400);
  });
  await t.test('New orders and transitions enqueue atomically; retries and notes do not duplicate alerts',async()=>{
   const id=randomUUID(),result=await mutate('createOrder',order(),id);
   const target=result.state.orders[0];assert.equal(await prisma.backgroundJob.count({where:{subjectKey:subject()}}),1);
   await mutate('createOrder',order(),id);assert.equal(await prisma.backgroundJob.count({where:{subjectKey:subject()}}),1);
   await mutate('note',{id:target.id,note:'Note changée'});assert.equal(await prisma.backgroundJob.count({where:{subjectKey:subject()}}),1);
   await mutate('transition',{id:target.id,status:'CONFIRMED'});assert.equal(await prisma.backgroundJob.count({where:{subjectKey:subject()}}),2);
   const rows=await prisma.backgroundJob.findMany({where:{subjectKey:subject()}});
   for(const row of rows){assert.ok(row.payload);assert.equal(row.payload!.includes(owner.email),false);
    const json=JSON.stringify(readJobPayload(row));for(const privateText of ['CLIENT-PRIVE','ADRESSE-PRIVEE','NOTE-PRIVEE','22123456'])assert.equal(json.includes(privateText),false);}
   const sent=await drain();assert.equal(sent.length,2);assert.ok(sent.every(m=>m.to===owner.email));
   assert.ok(sent.some(m=>m.text.includes('1.001 TND')||m.text.includes('9.001 TND')));
   assert.ok((await prisma.backgroundJob.findMany({where:{subjectKey:subject()}})).every(j=>j.status==='SUCCEEDED'&&j.payload===null));
  });
  await t.test('Transaction rollback cannot leave an orphan mail job',async()=>{
   const before=await prisma.backgroundJob.count();const after=structuredClone(state);
   const current=(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId}})).data as unknown as typeof state;
   after.orders=[{...current.orders[0],id:randomUUID()}];
   await assert.rejects(prisma.$transaction(async tx=>{await enqueueOrderMail(tx,{shopId},state,after,999);throw Error('rollback-fixture');}),/rollback-fixture/);
   assert.equal(await prisma.backgroundJob.count(),before);
  });
  await t.test('Public independent and legacy checkout retries queue only once',async()=>{
   const raw=order('55123456'),checkout={requestId:randomUUID(),name:raw.name,phone:raw.phone,city:'Tunis' as const,address:raw.address,items:raw.items};
   const before=await prisma.backgroundJob.count();await createPublicCodOrder(slug,checkout);await createPublicCodOrder(slug,checkout);
   assert.equal(await prisma.backgroundJob.count(),before+1);
   assert.equal((await put('/api/v1/shops/'+legacyShop+'/notifications',input(0))).status,200);
   const legacy={requestId:randomUUID(),customer:{name:raw.name,phone:raw.phone,city:raw.city,address:raw.address},items:raw.items};
   await createLegacyPublicOrder(slug+'-legacy',legacy);await createLegacyPublicOrder(slug+'-legacy',legacy);
   assert.equal(await prisma.backgroundJob.count(),before+2);
   await mutateLegacyCommerce(ownerId,{action:'createOrder',payload:order('99123456'),requestId:randomUUID()});
   assert.equal(await prisma.backgroundJob.count(),before+3);
   assert.equal((await drain()).length,3);
  });
  await t.test('Changed or unverified recipient and revoked owner membership prevent delivery',async()=>{
   await mutate('createOrder',order());await prisma.user.update({where:{id:ownerId},data:{email:slug+'-changed@example.test'}});
   assert.equal((await drain()).length,0);
   await prisma.user.update({where:{id:ownerId},data:{email:owner.email,emailVerifiedAt:null}});
   const count=await prisma.backgroundJob.count();await mutate('createOrder',order());assert.equal(await prisma.backgroundJob.count(),count);
   await prisma.user.update({where:{id:ownerId},data:{emailVerifiedAt:new Date()}});
   await mutate('createOrder',order());await prisma.membership.update({where:{shopId_userId:{shopId,userId:ownerId}},data:{active:false}});
   assert.equal((await drain()).length,0);
   await prisma.membership.update({where:{shopId_userId:{shopId,userId:ownerId}},data:{active:true}});
  });
  await t.test('Disabling cancels queued mail and erases content; other shops remain unchanged',async()=>{
   await mutate('createOrder',order());const legacyBefore=await prisma.shopOrderMail.findUniqueOrThrow({where:{shopId:legacyShop}});
   assert.equal((await put(endpoint(),input(1,false))).status,200);
   assert.equal(await prisma.backgroundJob.count({where:{subjectKey:subject(),status:'PENDING'}}),0);
   assert.equal((await drain()).length,0);
   assert.deepEqual(await prisma.shopOrderMail.findUniqueOrThrow({where:{shopId:legacyShop}}),legacyBefore);
   const data=await (await get(endpoint(),cookie)).json();assert.ok(data.jobs.some((j:{status:string})=>j.status==='CANCELLED'));
   for(const job of data.jobs)for(const field of ['payload','subjectKey','dedupKey','email','text'])assert.equal(field in job,false);
  });
  await t.test('Missing encryption records failure without blocking the order',async()=>{
   assert.equal((await put(endpoint(),input(2))).status,200);
   const secret=process.env.APP_ENCRYPTION_SECRET;delete process.env.APP_ENCRYPTION_SECRET;
   try{await mutate('createOrder',order());}finally{process.env.APP_ENCRYPTION_SECRET=secret;}
   assert.equal(await prisma.backgroundJob.count({where:{subjectKey:subject(),errorCode:'CONFIGURATION_MISSING',payload:null}}),1);
  });
  await t.test('SMTP failures retry and expired messages never send',async()=>{
   await mutate('createOrder',order());await processOneJob(async()=>{throw Error('fake-smtp-error');});
   const retry=await prisma.backgroundJob.findFirstOrThrow({where:{subjectKey:subject(),status:'PENDING'}});
   assert.equal(retry.errorCode,'DELIVERY_FAILED');assert.equal(retry.attempts,1);assert.ok(retry.payload);
   await prisma.backgroundJob.update({where:{id:retry.id},data:{status:'CANCELLED',payload:null,finishedAt:new Date()}});
   const expired=await prisma.$transaction(tx=>enqueueJob(tx,{kind:'ORDER_EMAIL',subjectKey:subject(),dedupKey:randomUUID(),
    payload:{shopId,ownerId,email:owner.email,at:new Date(Date.now()-49*3600000).toISOString(),subject:'Expired fixture',text:'Never send'}}));
   assert.equal((await drain()).length,0);
   assert.equal((await prisma.backgroundJob.findUniqueOrThrow({where:{id:expired.id}})).errorCode,'EXPIRED');
  });
  await t.test('Unconfigured SMTP cannot activate alerts or modify the stored preference',async()=>{
   const before=await prisma.shopOrderMail.findUniqueOrThrow({where:{shopId}}),host=process.env.SMTP_HOST;
   delete process.env.SMTP_HOST;
   try{await assert.rejects(saveOrderMail(ownerId,shopId,input(before.version)),(e:unknown)=>e instanceof Error&&'status' in e&&e.status===503);}
   finally{process.env.SMTP_HOST=host;}
   assert.deepEqual(await prisma.shopOrderMail.findUniqueOrThrow({where:{shopId}}),before);
  });
 }finally{
  if(server&&server.exitCode===null){const exited=once(server,'exit');stopTestServer(server);await exited;}
  if(shopId||legacyShop)await prisma.backgroundJob.deleteMany({where:{subjectKey:{in:['shop-order:'+shopId,'shop-order:'+legacyShop]}}});
  await prisma.organization.deleteMany({where:{id:{in:[org,otherOrg].filter(Boolean)}}});
  await prisma.user.deleteMany({where:{id:{in:[ownerId,otherId].filter(Boolean)}}});
  await prisma.subscriptionPlan.deleteMany({where:{code:plan}});
  await prisma.$disconnect();
 }
});
