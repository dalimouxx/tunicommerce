import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('_test'))throw Error('TEST_DATABASE_URL must point to a dedicated database ending in _test');
process.env.DATABASE_URL=url;
const {prisma}=await import('../modules/storage/client');
const {readWorkspace,saveWorkspace}=await import('../modules/storage/repository');
const {applyAction}=await import('../modules/commerce/service');
const {consumeAttempt}=await import('../modules/auth/service');
const {digest}=await import('../modules/auth/crypto');
const base='http://127.0.0.1:3137';const origin='https://test.local';
const token=randomBytes(32).toString('hex');const password=randomBytes(24).toString('hex');
let child:ReturnType<typeof spawn>;
let cookie='';
const post=(path:string,body:unknown,session=cookie,requestOrigin=origin)=>fetch(base+path,{method:'POST',headers:{origin:requestOrigin,'content-type':'application/json',cookie:session},body:JSON.stringify(body),redirect:'manual'});
async function login(){const r=await post('/api/auth/login',{email:'owner@example.test',password},'');assert.equal(r.status,200);cookie=r.headers.get('set-cookie')!.split(';')[0];return r;}

test('PostgreSQL and HTTP integration',async t=>{
 try{
  // This suite is deliberately destructive only inside its explicitly named test DB.
  await prisma.platformAudit.deleteMany();await prisma.publicReceipt.deleteMany();await prisma.session.deleteMany();await prisma.workspace.deleteMany();await prisma.user.deleteMany();await prisma.setupLock.deleteMany();await prisma.authThrottle.deleteMany();
  child=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3137',DATABASE_URL:url,APP_URL:origin,SETUP_TOKEN:token},stdio:'ignore'});
  let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Test web server exited');try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break;}}catch{}await delay(200);}assert.ok(ready,'Web server ready');
  await t.test('Anonymous requests and forged ChatGPT headers cannot access data',async()=>{const r=await fetch(base+'/api/commerce',{headers:{'oai-authenticated-user-id':'attacker','oai-authenticated-user-email':'attacker@example.test'}});assert.equal(r.status,401);const page=await fetch(base,{redirect:'manual'});assert.equal(page.status,307);assert.ok(page.headers.get('location')?.includes('/login'));});
  await t.test('Setup requires the secret and can create only one owner',async()=>{const input={email:'OWNER@example.test',name:'Owner Test',password,token};assert.equal((await post('/api/auth/setup',{...input,token:'bad'.repeat(20)},'')).status,403);assert.equal((await post('/api/auth/setup',input,'','https://evil.test')).status,403);const replies=await Promise.all([post('/api/auth/setup',input,''),post('/api/auth/setup',input,'')]);assert.deepEqual(replies.map(r=>r.status).sort(),[201,409]);assert.equal(await prisma.user.count(),1);});
  await t.test('Login rejects invalid password and creates a secure hashed session',async()=>{assert.equal((await post('/api/auth/login',{email:'owner@example.test',password:'wrong'},'')).status,401);const r=await login();const header=r.headers.get('set-cookie')!;assert.match(header,/HttpOnly/i);assert.match(header,/Secure/i);assert.match(header,/SameSite=lax/i);assert.match(header,/__Host-tunicommerce/);const raw=cookie.split('=')[1];const row=await prisma.session.findUnique({where:{tokenHash:digest(raw)}});assert.ok(row);assert.notEqual(row.tokenHash,raw);});
  await t.test('Concurrent first workspace requests create a single workspace',async()=>{const results=await Promise.all([fetch(base+'/api/commerce',{headers:{cookie}}),fetch(base+'/api/commerce',{headers:{cookie}})]);assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(await prisma.workspace.count(),1);});
  await t.test('Actual HTTP API keeps concurrent retries idempotent',async()=>{const before=await (await fetch(base+'/api/commerce',{headers:{cookie}})).json();const body={action:'createOrder',requestId:crypto.randomUUID(),payload:{name:'Test Client',phone:'22111222',city:'Gabès',address:'12 Rue Test',source:'Manuel',items:[{productId:'p1',quantity:2}],ownerId:'forged',total:1}};const results=await Promise.all([post('/api/commerce',body),post('/api/commerce',body)]);assert.deepEqual(results.map(r=>r.status),[200,200]);const after=await (await fetch(base+'/api/v1/commerce',{headers:{cookie}})).json();assert.equal(after.state.orders.length,before.state.orders.length+1);assert.equal(after.state.products[0].stock,before.state.products[0].stock-2);assert.equal(after.state.orders[0].total,186000);assert.equal((await post('/api/commerce',body,cookie,'https://evil.test')).status,403);});
  await t.test('PostgreSQL CAS rejects stale writes and isolates owners',async()=>{const owner=await prisma.user.findUniqueOrThrow({where:{email:'owner@example.test'}});const second=await prisma.user.create({data:{email:'second@example.test',name:'Test',passwordHash:'not-a-real-password'}});const a=await readWorkspace(owner.id);const b=await readWorkspace(second.id);const next=applyAction(a.state,'settings',{name:'Changed',phone:'',address:'',shipping:9000});const results=await Promise.all([saveWorkspace(owner.id,next,a.version),saveWorkspace(owner.id,next,a.version)]);assert.equal(results.filter(Boolean).length,1);assert.equal(await saveWorkspace('unknown-owner',next,a.version),false);assert.equal((await readWorkspace(second.id)).state.shop.name,b.state.shop.name);});
  await t.test('Platform roles, tenant isolation, publication and checkout are enforced',async()=>{
    const owner=await prisma.user.findUniqueOrThrow({where:{email:'owner@example.test'}});assert.equal(owner.role,'ADMIN');
    const shop=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
    const config={slug:'test-store',published:true,plan:'PRO',subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000).toISOString()};
    assert.equal((await post('/api/admin/shops',{action:'update',id:shop.id,...config},'')).status,401);
    assert.equal((await post('/api/admin/shops',{action:'update',id:shop.id,...config})).status,200);
    const html=await (await fetch(base+'/boutiques/test-store')).text();assert.ok(html.includes('Casque sans fil'));assert.ok(!html.includes('owner@example.test'));assert.ok(!html.includes('22111222'));assert.ok(!html.includes('passwordHash'));
    const create={action:'create',name:'New Merchant',email:'merchant@example.test',password,shopName:'New Store',...config,slug:'second-store'};
    assert.equal((await post('/api/admin/shops',create)).status,200);
    const merchant=await prisma.user.findUniqueOrThrow({where:{email:create.email}});assert.equal(merchant.role,'MERCHANT');
    const loginResponse=await post('/api/auth/login',{email:create.email,password},'');const merchantCookie=loginResponse.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await post('/api/admin/shops',{action:'update',id:shop.id,...config},merchantCookie)).status,403);
    const own=await (await fetch(base+'/api/commerce',{headers:{cookie:merchantCookie}})).json();assert.equal(own.state.shop.name,'New Store');assert.equal(own.state.orders.length,0);
    const body={requestId:crypto.randomUUID(),customer:{name:'Public Buyer',phone:'22999888',city:'Tunis',address:'Public Street'},items:[{productId:'p1',quantity:1}],ownerId:merchant.id,total:1};
    const before=await readWorkspace(owner.id);
    const results=await Promise.all([post('/api/boutiques/test-store/checkout',body,''),post('/api/boutiques/test-store/checkout',body,'')]);assert.deepEqual(results.map(r=>r.status),[201,201]);const receipts=await Promise.all(results.map(r=>r.json()));assert.deepEqual(receipts[0],receipts[1]);assert.deepEqual(Object.keys(receipts[0]).sort(),['reference','total','trackingUrl']);assert.equal(receipts[0].total,98000);
    const after=await readWorkspace(owner.id);assert.equal(after.state.orders.length,before.state.orders.length+1);assert.equal(after.state.products[0].stock,before.state.products[0].stock-1);
    const trackingUrl=receipts[0].trackingUrl;assert.match(trackingUrl,/^\/suivi\/[a-f0-9]{64}$/);
    const trackingPage=await fetch(base+trackingUrl);assert.equal(trackingPage.status,200);const trackingHtml=await trackingPage.text();assert.ok(trackingHtml.includes(receipts[0].reference));assert.ok(!trackingHtml.includes('22999888'));assert.ok(!trackingHtml.includes('Public Street'));
    assert.equal((await fetch(base+'/suivi/'+'0'.repeat(64))).status,404);
    const request={id:crypto.randomUUID(),type:'CANCEL',reason:'Je souhaite annuler cette commande'};
    assert.equal((await post('/api'+trackingUrl,request,'','https://evil.test')).status,403);
    const customerRequests=await Promise.all([post('/api'+trackingUrl,request,''),post('/api'+trackingUrl,request,'')]);assert.deepEqual(customerRequests.map(r=>r.status),[200,200]);
    const requested=await readWorkspace(owner.id);assert.equal(requested.state.orders[0].customerRequests?.length,1);
    const resolution={action:'resolveCustomerRequest',requestId:crypto.randomUUID(),payload:{orderId:requested.state.orders[0].id,requestId:request.id,status:'ACCEPTED',reply:'Annulation confirmée'}};
    assert.equal((await post('/api/commerce',resolution,merchantCookie)).status,400);
    assert.equal((await post('/api/commerce',resolution)).status,200);const cancelled=await readWorkspace(owner.id);assert.equal(cancelled.state.orders[0].status,'CANCELLED');assert.equal(cancelled.state.products[0].stock,before.state.products[0].stock);
    assert.equal((await post('/api/boutiques/second-store/checkout',{...body,requestId:crypto.randomUUID()},'')).status,400);
    for(const change of [{subscriptionStatus:'SUSPENDED'},{subscriptionEndsAt:new Date(0).toISOString()},{published:false}]){
      assert.equal((await post('/api/admin/shops',{action:'update',id:shop.id,...config,...change})).status,200);
      assert.equal((await fetch(base+'/boutiques/test-store')).status,404);
      assert.equal((await post('/api/boutiques/test-store/checkout',{...body,requestId:crypto.randomUUID()},'')).status,403);
    }
    assert.equal((await post('/api/admin/shops',{action:'update',id:shop.id,...config},cookie,'https://evil.test')).status,403);
    assert.ok(await prisma.platformAudit.count()>=5);
  });
  await t.test('Expired and revoked sessions cannot be reused',async()=>{const raw=cookie.split('=')[1];await prisma.session.update({where:{tokenHash:digest(raw)},data:{expiresAt:new Date(0)}});assert.equal((await fetch(base+'/api/commerce',{headers:{cookie}})).status,401);await login();const old=cookie;assert.equal((await post('/api/auth/logout',{})).status,200);assert.equal((await fetch(base+'/api/commerce',{headers:{cookie:old}})).status,401);});
  await t.test('Persistent throttle enforces the limit atomically',async()=>{const key='parallel-test';const results=await Promise.allSettled(Array.from({length:12},()=>consumeAttempt(key,3)));assert.equal(results.filter(r=>r.status==='fulfilled').length,3);await prisma.authThrottle.update({where:{key},data:{expiresAt:new Date(0)}});await consumeAttempt(key,3);assert.equal((await prisma.authThrottle.findUniqueOrThrow({where:{key}})).count,1);});
 }finally{child?.kill('SIGTERM');await prisma.$disconnect();}
});
