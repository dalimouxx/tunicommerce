import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {stopTestServer} from './server-process';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)
 throw Error('Account security tests require matching disposable *_test PostgreSQL databases');
const origin='https://account-security.example.test',base='http://127.0.0.1:3194';
process.env.APP_URL=origin;process.env.APP_ENCRYPTION_SECRET=randomBytes(40).toString('hex');
process.env.SMTP_HOST='smtp.invalid.example';process.env.SMTP_USER='test-only';process.env.SMTP_PASSWORD='test-only';
process.env.SMTP_PORT='587';process.env.MAIL_FROM='security@example.test';
const {prisma}=await import('../modules/storage/client');
const {hashPassword,digest,newSession}=await import('../modules/auth/crypto');
const {processOneJob}=await import('../modules/jobs/worker');
const {leaseNextJob,finishJob,enqueueJob}=await import('../modules/jobs/service');
const {open}=await import('../modules/security/envelope');
const {totpCode}=await import('../modules/auth/totp');
let server:ChildProcess|undefined;
const mark=randomUUID().slice(0,8),email='account-'+mark+'@example.test',otherEmail='other-'+mark+'@example.test';
const password='Account-Fixture-Only-2026!';let currentPassword=password,cookie='',otherCookie='';
let userId='',otherId='',adminId='';
const get=(path:string,session='')=>fetch(base+path,{headers:{cookie:session},redirect:'manual'});
const post=(path:string,body:unknown,session='',from=origin)=>fetch(base+path,{method:'POST',headers:{cookie:session,origin:from,'content-type':'application/json'},body:JSON.stringify(body),redirect:'manual'});
async function start(configured=true){
 server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3194',
  SMTP_HOST:configured?process.env.SMTP_HOST:'',DATABASE_URL:database,APP_URL:origin},stdio:'ignore'});
 for(let i=0;i<120;i++){
  if(server.exitCode!==null)throw Error('Test application exited');
  try{if((await get('/api/health')).ok)return;}catch{}
  await pause(250);
 }
 throw Error('Test application not ready');
}
async function stop(){if(server&&server.exitCode===null){const exited=once(server,'exit');stopTestServer(server);await exited;}server=undefined;}
async function login(emailAddress=email,pw=currentPassword,otp?:string){
 return post('/api/auth/merchant/login',{email:emailAddress,password:pw,...(otp?{otp}:{})});
}
function session(response:Response){return response.headers.get('set-cookie')!.split(';')[0];}
async function sentLinks(){
 const messages:{id:string;to:string;subject:string;text:string}[]=[];
 for(let i=0;i<20;i++){if(!await processOneJob(async input=>{messages.push(input);}))break;}
 return messages.map(message=>({message,url:new URL(message.text.split('\n').find(line=>line.startsWith('https://'))!)}));
}
test('Account recovery, email verification, MFA and durable jobs',async t=>{
 try{
  await prisma.backgroundJob.deleteMany();
  userId=(await prisma.user.create({data:{email,name:'Account fixture',passwordHash:await hashPassword(password)}})).id;
  otherId=(await prisma.user.create({data:{email:otherEmail,name:'Other fixture',passwordHash:await hashPassword(password)}})).id;
  await start(false);
  await t.test('Unconfigured sending is explicit and cannot issue recovery tokens',async()=>{
   const result=await post('/api/auth/account/request',{email});assert.equal(result.status,503);
   assert.equal(await prisma.accountActionToken.count({where:{userId}}),0);
   assert.equal(await prisma.backgroundJob.count(),0);
   assert.ok((await (await get('/compte/recuperer')).text()).includes('pas encore configuré'));
  });
  await stop();await start();
  cookie=session(await login());otherCookie=session(await login(otherEmail));
  await t.test('Recovery responses do not disclose account existence; job contents are encrypted',async()=>{
   const known=await post('/api/auth/account/request',{email,portal:'MERCHANT'});
   const unknown=await post('/api/auth/account/request',{email:'absent-'+mark+'@example.test',portal:'MERCHANT'});
   assert.equal(known.status,202);assert.equal(unknown.status,202);assert.deepEqual(await known.json(),await unknown.json());
   const row=await prisma.backgroundJob.findFirstOrThrow({where:{subjectKey:'account:'+userId+':RESET_PASSWORD'}});
   assert.equal(row.payload!.includes(email),false);assert.equal(row.payload!.includes('/compte/'),false);
   assert.equal((await post('/api/auth/account/request',{email},'','https://evil.example')).status,403);
   assert.equal((await get('/api/auth/account/reset')).status,405);
  });
  await t.test('Password reset consumes a link once, revokes sessions and rejects wrong purpose',async()=>{
   const [{url}]=await sentLinks(),token=new URLSearchParams(url.hash.slice(1)).get('jeton')!;
   assert.equal(url.search,'');assert.equal(url.pathname,'/compte/reinitialiser');
   assert.equal((await post('/api/auth/account/verify',{token})).status,400);
   const fresh='Changed-Fixture-Only-2026!';
   const responses=await Promise.all([1,2].map(()=>post('/api/auth/account/reset',{token,password:fresh})));
   assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
   assert.equal((await get('/compte/securite',cookie)).status,307);
   assert.equal((await login(email,password)).status,401);
   currentPassword=fresh;cookie=session(await login());
   const stale=newSession();await prisma.session.create({data:{userId,tokenHash:digest(stale.token),expiresAt:stale.expiresAt,authVersion:0}});
   assert.equal((await get('/compte/securite','__Host-tunicommerce='+stale.token)).status,307);
  });
  await t.test('Only the signed-in account can request email verification',async()=>{
   const path='/api/auth/account/verify';
   assert.equal((await fetch(base+path,{method:'PUT',headers:{origin,'content-type':'application/json'},body:'{}'})).status,401);
   const response=await fetch(base+path,{method:'PUT',headers:{origin,cookie,'content-type':'application/json'},body:'{}'});
   assert.equal(response.status,202);
   const [{url,message}]=await sentLinks();assert.equal(message.to,email);
   const token=new URLSearchParams(url.hash.slice(1)).get('jeton')!;
   assert.equal((await post(path,{token})).status,200);assert.equal((await post(path,{token})).status,400);
   assert.ok((await prisma.user.findUniqueOrThrow({where:{id:userId}})).emailVerifiedAt);
   assert.equal((await prisma.user.findUniqueOrThrow({where:{id:otherId}})).emailVerifiedAt,null);
  });
  await t.test('Replacing a request cancels old mail; expired tokens do not alter passwords',async()=>{
   // Verification and recovery deliberately share the same email request limit.
   await prisma.authThrottle.deleteMany({where:{key:'account-mail:'+digest(email)}});
   assert.equal((await post('/api/auth/account/request',{email})).status,202);
   const old=await prisma.accountActionToken.findUniqueOrThrow({where:{userId_purpose:{userId,purpose:'RESET_PASSWORD'}}});
   assert.equal((await post('/api/auth/account/request',{email})).status,202);
   const current=await prisma.accountActionToken.findUniqueOrThrow({where:{userId_purpose:{userId,purpose:'RESET_PASSWORD'}}});
   assert.notEqual(old.tokenHash,current.tokenHash);
   assert.equal(await prisma.backgroundJob.count({where:{subjectKey:'account:'+userId+':RESET_PASSWORD',status:'PENDING'}}),1);
   const [{url}]=await sentLinks(),token=new URLSearchParams(url.hash.slice(1)).get('jeton')!;
   await prisma.accountActionToken.update({where:{tokenHash:current.tokenHash},data:{expiresAt:new Date(0)}});
   assert.equal((await post('/api/auth/account/reset',{token,password:'Another-Fixture-Only-2026!'})).status,400);
   assert.equal((await login()).status,200);
  });
  let codes:string[]=[];
  await t.test('MFA enrollment requires password and live code; old sessions and reused codes are rejected',async()=>{
   const extraCookie=session(await login());
   const request={action:'begin',portal:'MERCHANT',password:currentPassword};
   assert.equal((await post('/api/auth/account/mfa',request)).status,401);
   assert.equal((await post('/api/auth/account/mfa',{...request,portal:'ADMIN'},cookie)).status,401);
   assert.equal((await post('/api/auth/account/mfa',{...request,password:'wrong'},cookie)).status,401);
   const begin=await post('/api/auth/account/mfa',request,cookie);assert.equal(begin.status,200);
   const data=await begin.json();assert.match(data.secret,/^[A-Z2-7]{32}$/);
   const pending=await prisma.user.findUniqueOrThrow({where:{id:userId}});
   const decoded=open(pending.mfaPendingSecret!,'mfa-pending:'+userId) as {secret:string};
   const otp=totpCode(Buffer.from(decoded.secret,'base64'),Math.floor(Date.now()/30000));
   const confirmed=await post('/api/auth/account/mfa',{action:'confirm',password:currentPassword,otp},cookie);
   assert.equal(confirmed.status,200);codes=(await confirmed.json()).recoveryCodes;assert.equal(codes.length,10);
   assert.equal((await get('/compte/securite',extraCookie)).status,307);
   assert.equal((await get('/compte/securite',cookie)).status,200);
   const missing=await login();assert.equal(missing.status,401);assert.equal((await missing.json()).requiresMfa,true);
   assert.equal((await login(email,currentPassword,otp)).status,401);
   const recovery=await login(email,currentPassword,codes[0]);assert.equal(recovery.status,200);cookie=session(recovery);
   assert.equal((await login(email,currentPassword,codes[0])).status,401);
   const stored=await prisma.mfaRecoveryCode.findMany({where:{userId}});
   assert.equal(stored.some(row=>codes.includes(row.codeHash)),false);
  });
  await t.test('An email password reset does not bypass enabled MFA; disabling requires a second factor',async()=>{
   // Reset the request throttle explicitly inside this disposable test database.
   await prisma.authThrottle.deleteMany({where:{key:'account-mail:'+digest(email)}});
   await post('/api/auth/account/request',{email});
   const [{url}]=await sentLinks(),token=new URLSearchParams(url.hash.slice(1)).get('jeton')!;
   const fresh='Third-Fixture-Only-2026!';
   assert.equal((await post('/api/auth/account/reset',{token,password:fresh})).status,200);currentPassword=fresh;
   assert.ok((await prisma.user.findUniqueOrThrow({where:{id:userId}})).mfaEnabledAt);
   assert.equal((await login()).status,401);
   cookie=session(await login(email,currentPassword,codes[1]));
   const bad=await post('/api/auth/account/mfa',{action:'disable',password:currentPassword,otp:'bad'},cookie);
   assert.equal(bad.status,401);
   assert.equal((await post('/api/auth/account/mfa',{action:'disable',password:currentPassword,otp:codes[2]},cookie)).status,200);
   assert.equal((await login()).status,200);
  });
  await t.test('Task monitoring is admin-only and does not disclose encrypted job contents',async()=>{
   assert.equal((await get('/admin/taches')).status,307);
   assert.equal((await get('/admin/taches',cookie)).status,307);
   const adminEmail='admin-security-'+mark+'@example.test';
   adminId=(await prisma.user.create({data:{email:adminEmail,name:'Security admin fixture',role:'ADMIN',passwordHash:await hashPassword(password)}})).id;
   const signedIn=await post('/api/auth/admin/login',{email:adminEmail,password});assert.equal(signedIn.status,200);
   const adminCookie=session(signedIn);
   const job=await prisma.$transaction(tx=>enqueueJob(tx,{kind:'TEST',subjectKey:'fixture',dedupKey:randomUUID(),payload:{recipient:email,token:'private-monitor-fixture'}}));
   const response=await get('/admin/taches',adminCookie);assert.equal(response.status,200);
   const html=await response.text();assert.ok(html.includes('Tâches en arrière-plan'));
   assert.equal(html.includes(email),false);assert.equal(html.includes('private-monitor-fixture'),false);assert.equal(html.includes(job.payload!),false);
   assert.equal((await get('/compte/securite?portail=ADMIN',cookie)).status,307);
   assert.equal((await get('/compte/securite?portail=ADMIN',adminCookie)).status,200);
  });
  await t.test('Workers claim exclusively, recover leases and reject stale completion',async()=>{
   await prisma.backgroundJob.deleteMany();
   const job=await prisma.$transaction(tx=>enqueueJob(tx,{kind:'TEST',subjectKey:'fixture',dedupKey:randomUUID(),payload:{private:'fixture'}}));
   const leases=await Promise.all([leaseNextJob(),leaseNextJob()]);assert.equal(leases.filter(Boolean).length,1);
   const first=leases.find(Boolean)!;
   await prisma.backgroundJob.update({where:{id:job.id},data:{lockedUntil:new Date(0)}});
   const second=(await leaseNextJob())!;assert.notEqual(first.leaseId,second.leaseId);assert.equal(second.attempts,2);
   assert.equal(await finishJob(first),false);assert.equal(await finishJob(second),true);
   const done=await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}});assert.equal(done.payload,null);
  });
  await t.test('Delivery failures retry later, stop at the limit and erase protected contents',async()=>{
   const job=await prisma.$transaction(tx=>enqueueJob(tx,{kind:'TEST',subjectKey:'fixture',dedupKey:randomUUID(),payload:{private:'fixture'}}));
   const first=(await leaseNextJob())!;
   assert.equal(first.id,job.id);assert.equal(await finishJob(first,'DELIVERY_FAILED'),true);
   const retry=await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}});
   assert.equal(retry.status,'PENDING');assert.ok(retry.payload);assert.ok(retry.availableAt.getTime()>Date.now()+10000);
   assert.equal(await leaseNextJob(),null);
   await prisma.backgroundJob.update({where:{id:job.id},data:{availableAt:new Date(0),attempts:3}});
   const last=(await leaseNextJob())!;assert.equal(last.attempts,4);
   await finishJob(last,'DELIVERY_FAILED');
   const failed=await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}});
   assert.equal(failed.status,'FAILED');assert.equal(failed.payload,null);assert.equal(await leaseNextJob(),null);
  });
  await t.test('Unsupported tasks and exhausted leases fail without external sending',async()=>{
   const job=await prisma.$transaction(tx=>enqueueJob(tx,{kind:'UNSUPPORTED',subjectKey:'fixture',dedupKey:randomUUID(),payload:{private:'fixture'}}));
   await processOneJob(async()=>{throw Error('Unexpected external send');});
   const row=await prisma.backgroundJob.findUniqueOrThrow({where:{id:job.id}});
   assert.equal(row.status,'FAILED');assert.equal(row.errorCode,'UNSUPPORTED_KIND');assert.equal(row.payload,null);
   const crashed=await prisma.$transaction(tx=>enqueueJob(tx,{kind:'TEST',subjectKey:'fixture',dedupKey:randomUUID(),payload:{private:'fixture'}}));
   await prisma.backgroundJob.update({where:{id:crashed.id},data:{status:'PROCESSING',attempts:4,lockedUntil:new Date(0),leaseId:randomUUID()}});
   assert.equal(await leaseNextJob(),null);
   const exhausted=await prisma.backgroundJob.findUniqueOrThrow({where:{id:crashed.id}});
   assert.equal(exhausted.status,'FAILED');assert.equal(exhausted.errorCode,'LEASE_EXPIRED');assert.equal(exhausted.payload,null);
  });
 }finally{
  await stop();
  if(userId)await prisma.backgroundJob.deleteMany({where:{OR:[{subjectKey:{startsWith:'account:'+userId+':'}},{subjectKey:'fixture'}]}});
  await prisma.user.deleteMany({where:{id:{in:[userId,otherId,adminId].filter(Boolean)}}});
  await prisma.$disconnect();
 }
});
