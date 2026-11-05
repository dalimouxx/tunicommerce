import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
const db=process.env.TEST_DATABASE_URL;
if(!db||!new URL(db).pathname.endsWith('_test')||process.env.DATABASE_URL!==db)
 throw Error('Portal test requires disposable *_test PostgreSQL database');
const {prisma}=await import('../modules/storage/client');
const origin='https://portal-security-test.local',host='http://127.0.0.1:3177';
const setupToken=randomBytes(32).toString('hex');
const password='Portal-Independent-Strong-2026!';
const get=(path:string,cookie='')=>fetch(host+path,{headers:{cookie},redirect:'manual'});
const post=(path:string,data:unknown,cookie='',requestOrigin=origin)=>fetch(host+path,{
 method:'POST',redirect:'manual',headers:{origin:requestOrigin,'content-type':'application/json',cookie},body:JSON.stringify(data)
});
test('Super Admin and Boutique have distinct role-gated cookies, login screens and logout',async()=>{
 let server:ChildProcess|undefined;
 try{
  await prisma.membership.deleteMany();await prisma.shop.deleteMany();
  await prisma.organization.deleteMany();await prisma.platformAudit.deleteMany();
  await prisma.session.deleteMany();await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();await prisma.setupLock.deleteMany();await prisma.authThrottle.deleteMany();
  server=spawn(process.execPath,['scripts/start.mjs'],{env:{
   ...process.env,NODE_ENV:'production',PORT:'3177',DATABASE_URL:db,APP_URL:origin,SETUP_TOKEN:setupToken
  },stdio:'ignore'});
  let ready=false;
  for(let i=0;i<120;i++){
   if(server.exitCode!==null)throw Error('Portal test server exited unexpectedly');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await sleep(250);
  }
  assert.equal(ready,true);
  assert.equal((await get('/connexion')).status,200);
  assert.equal((await get('/connexion/admin')).status,200);
  assert.equal((await get('/connexion/boutique')).status,200);
  assert.equal((await get('/admin')).headers.get('location'),'/connexion/admin');

  const setup=await post('/api/auth/setup',{
   name:'Plateforme Admin',email:'admin@portal.example.test',password,token:setupToken
  });
  assert.equal(setup.status,201);
  const signup=await post('/api/auth/register',{
   name:'Marchand Client',email:'shop@portal.example.test',password,
   shopName:'Boutique Test',slug:'boutique-test'
  });
  assert.equal(signup.status,201);
  const merchantCookie=signup.headers.get('set-cookie')!.split(';')[0];
  assert.ok(merchantCookie.startsWith('__Host-tunicommerce='));

  const denied=await post('/api/auth/admin/login',{email:'shop@portal.example.test',password});
  assert.equal(denied.status,401);
  assert.equal(denied.headers.get('set-cookie'),null);

  const admin=await post('/api/auth/admin/login',{email:'admin@portal.example.test',password});
  assert.equal(admin.status,200);
  const adminCookie=admin.headers.get('set-cookie')!.split(';')[0];
  assert.ok(adminCookie.startsWith('__Host-tunicommerce-admin='));
  assert.equal((await get('/admin',adminCookie)).status,200);
  assert.equal((await get('/admin',merchantCookie)).headers.get('location'),'/connexion/admin');
  assert.equal((await get('/mes-boutiques',adminCookie)).status,307);
  assert.equal((await get('/mes-boutiques',merchantCookie)).status,200);
  assert.equal((await get('/api/admin/plans',merchantCookie)).status,401);
  assert.equal((await get('/api/admin/plans',adminCookie)).status,200);
  assert.equal((await get('/api/admin/plans')).status,401);
  assert.equal((await post('/api/auth/admin/login',{email:'admin@portal.example.test',password},'', 'https://evil.local')).status,403);
  assert.equal((await post('/api/auth/admin/logout',{},adminCookie)).status,200);
  assert.equal((await get('/mes-boutiques',merchantCookie)).status,200);
  const oldCookie=await post('/api/auth/merchant/login',{email:'admin@portal.example.test',password});
  assert.equal(oldCookie.status,200);
  const personal=oldCookie.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await get('/admin',personal)).headers.get('location'),'/connexion/admin');
 }finally{server?.kill('SIGTERM');await prisma.$disconnect();}
});
