import test from 'node:test';
import {stopTestServer} from './server-process';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test'))
 throw Error('Reception tests require an isolated *_test database');
process.env.DATABASE_URL=database;
const {prisma}=await import('../modules/storage/client');
const base='http://127.0.0.1:3188';
const origin='https://test.local';
const password='Testing-Verified-Reception-2026!';
const setupToken=randomBytes(32).toString('hex');
let server:ChildProcess|undefined;

const get=(url:string,cookie='')=>fetch(base+url,{headers:{cookie},redirect:'manual'});
const post=(url:string,body:unknown,cookie='',requestOrigin=origin)=>fetch(base+url,{
 method:'POST',headers:{cookie,origin:requestOrigin,'content-type':'application/json'},
 body:JSON.stringify(body),redirect:'manual'
});
const validD17=(enabled=true,version=0)=>({
 code:'D17',enabled,version,recipientName:'Bénéficiaire de test',
 identifier:'TEST-D17-123456',bankName:'',
 instructions:'Instructions de test de paiement D17. Ne pas transférer de fonds.'
});
const validBank=(enabled=true,version=0)=>({
 code:'BANK_TRANSFER',enabled,version,recipientName:'Compte bancaire de test',
 identifier:'TEST-RIB-123456789000',bankName:'Banque fictive TEST',
 instructions:'Instructions de test de virement uniquement. Aucun fonds réel.'
});
async function reset(){
 await prisma.subscriptionPayment.deleteMany();
 await prisma.paymentReceptionAudit.deleteMany();
 await prisma.subscriptionPlanAudit.deleteMany();
 await prisma.workspacePlanOverride.deleteMany();
 await prisma.productMedia.deleteMany();
 await prisma.shopMedia.deleteMany();
 await prisma.shopInvitation.deleteMany();
 await prisma.membership.deleteMany();
 await prisma.shop.deleteMany();
 await prisma.organization.deleteMany();
 await prisma.platformAudit.deleteMany();
 await prisma.publicReceipt.deleteMany();
 await prisma.session.deleteMany();
 await prisma.workspace.deleteMany();
 await prisma.user.deleteMany();
 await prisma.setupLock.deleteMany();
 await prisma.authThrottle.deleteMany();
 await prisma.subscriptionPlan.deleteMany({where:{code:'RECEPTION_TEST'}});
 await prisma.paymentReceptionMethod.updateMany({data:{
  enabled:false,recipientName:'',identifier:'',bankName:'',instructions:'',version:0,
  updatedById:null
 }});
}

test('Official SaaS reception configuration: disabled defaults, safe publication, stale edits and merchant isolation',async t=>{
 try{
  await reset();
  server=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3188',DATABASE_URL:database,
    APP_URL:origin,SETUP_TOKEN:setupToken},stdio:'ignore'
  });
  let ready=false;
  for(let i=0;i<120;i++){
   if(server.exitCode!==null)throw Error('Test server exited unexpectedly');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true);

  await t.test('Anonymous users cannot see settings or authenticated instructions',async()=>{
   assert.equal((await get('/admin/coordonnees-paiement')).status,307);
   assert.equal((await get('/api/admin/payment-reception')).status,401);
   assert.equal((await get('/api/v1/subscription-payments')).status,401);
   assert.equal((await post('/api/admin/payment-reception',validD17())).status,401);
  });

  assert.equal((await post('/api/auth/setup',{
   name:'Administrateur des tests',email:'admin-reception@example.test',
   password,token:setupToken
  })).status,201);
  const adminLogin=await post('/api/auth/admin/login',{email:'admin-reception@example.test',password});
  assert.equal(adminLogin.status,200);
  const adminCookie=adminLogin.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await post('/api/admin/plans',{
   code:'RECEPTION_TEST',name:'Offre tests réception',
   description:'Test configuration des moyens de paiement',
   priceMillimes:19000,durationDays:30,maxProducts:null,maxOrdersPerMonth:null,
   maxPhotos:null,maxShops:null,maxMembers:null,
   modules:{
    callCenter:false,marketing:false,analytics:false,aiCopilot:false,
    customDomain:false,multiShop:false
   },enabled:true
  },adminCookie)).status,200);

  async function register(email:string,slug:string){
   const response=await post('/api/auth/register',{
    name:'Marchand test',email,password,shopName:slug,slug
   });
   assert.equal(response.status,201);
   return response.headers.get('set-cookie')!.split(';')[0];
  }
  const ownerA=await register('a-reception@example.test','reception-merchant-a');
  const ownerB=await register('b-reception@example.test','reception-merchant-b');

  await t.test('Methods start disabled and require verified configurations before allowing declarations',async()=>{
   const admin=(await (await get('/api/admin/payment-reception',adminCookie)).json());
   assert.equal(admin.methods.length,3);
   assert.equal(admin.methods.filter((m:{enabled:boolean})=>m.enabled).length,0);
   const publicInfo=(await (await get('/api/v1/subscription-payments',ownerA)).json());
   assert.deepEqual(publicInfo.methods,[]);
   const cannotDeclare=await post('/api/v1/subscription-payments',{
    requestId:randomUUID(),planCode:'RECEPTION_TEST',
    method:'D17',transferReference:'D17-ATTEMPT-001',merchantNote:''
   },ownerA);
   assert.equal(cannotDeclare.status,409);
   assert.equal(await prisma.subscriptionPayment.count(),0);
   assert.equal((await get('/api/admin/payment-reception',ownerA)).status,401);
   assert.equal((await post('/api/admin/payment-reception',validD17(),ownerA)).status,401);
  });

  await t.test('Cannot activate incomplete, forged or cross-origin bank coordinates',async()=>{
   assert.equal((await post('/api/admin/payment-reception',
    {...validD17(),identifier:''},adminCookie)).status,400);
   assert.equal((await post('/api/admin/payment-reception',
    {...validBank(),bankName:''},adminCookie)).status,400);
   assert.equal((await post('/api/admin/payment-reception',
    {...validBank(),instructions:'Too short'},adminCookie)).status,400);
   assert.equal((await post('/api/admin/payment-reception',
    validD17(),adminCookie,'https://attacker.test')).status,403);
   assert.equal((await post('/api/admin/payment-reception',
    {...validD17(),code:'CARD'},adminCookie)).status,400);
   const settingsPage=await get('/admin/coordonnees-paiement',adminCookie);
   assert.equal(settingsPage.status,200);
   assert.ok((await settingsPage.text()).includes('Coordonnées officielles de paiement'));
  });

  await t.test('Admin safely publishes D17 only and handles concurrent edits',async()=>{
   const publish=await post('/api/admin/payment-reception',validD17(),adminCookie);
   assert.equal(publish.status,200);
   const data=(await publish.json()).method;
   assert.equal(data.version,1);
   assert.equal(data.enabled,true);
   assert.equal((await post('/api/admin/payment-reception',
    validD17(true,0),adminCookie)).status,409);
   const ownerInfo=(await (await get('/api/v1/subscription-payments',ownerA)).json());
   assert.deepEqual(ownerInfo.methods.map((m:{code:string})=>m.code),['D17']);
   assert.equal(ownerInfo.methods[0].identifier,'TEST-D17-123456');
   assert.equal(ownerInfo.methods.some((m:{code:string})=>m.code==='BANK_TRANSFER'),false);
   const merchantPage=(await (await get('/mon-abonnement',ownerA)).text());
   assert.ok(merchantPage.includes('TEST-D17-123456'));
   assert.ok(!merchantPage.includes('TEST-RIB-'));
   assert.ok((await prisma.paymentReceptionAudit.count({where:{methodCode:'D17'}}))===1);
   const allAudit=(await (await get('/api/admin/payment-reception',adminCookie)).json()).history;
   assert.ok(!JSON.stringify(allAudit).includes('TEST-D17-123456'),
    'Global configuration audit must not duplicate recipient account numbers');
  });

  let pendingId='';
  await t.test('An enabled official D17 method allows a declaration but never instant renewal',async()=>{
   const response=await post('/api/v1/subscription-payments',{
    requestId:randomUUID(),planCode:'RECEPTION_TEST',
    method:'D17',transferReference:'TEST-TRANSFER-D17-AAAA',merchantNote:'Test seulement'
   },ownerA);
   assert.equal(response.status,201);
   pendingId=(await response.json()).payment.id;
   const user=await prisma.user.findUniqueOrThrow({where:{email:'a-reception@example.test'}});
   const ws=await prisma.workspace.findUniqueOrThrow({where:{ownerId:user.id}});
   assert.equal(ws.plan,'STARTER');
   assert.equal(ws.subscriptionStatus,'TRIAL');
   assert.equal((await prisma.subscriptionPayment.findUniqueOrThrow({where:{id:pendingId}})).status,'PENDING');
  });

  await t.test('Disabling a receiving method hides its details and refuses new declarations',async()=>{
   assert.equal((await post('/api/admin/payment-reception',{
    ...validD17(false,1)
   },adminCookie)).status,200);
   const info=(await (await get('/api/v1/subscription-payments',ownerB)).json());
   assert.equal(info.methods.length,0);
   assert.equal((await post('/api/v1/subscription-payments',{
    requestId:randomUUID(),planCode:'RECEPTION_TEST',
    method:'D17',transferReference:'TEST-TRANSFER-D17-BBBB',merchantNote:''
   },ownerB)).status,409);
   const page=(await (await get('/mon-abonnement',ownerB)).text());
   assert.ok(page.includes('Aucun moyen de paiement officiel'));
   assert.ok(!page.includes('TEST-D17-123456'));
   // Already submitted claims remain payable after the method is switched off.
   const approved=await post('/api/admin/subscription-payments',{
    id:pendingId,action:'approve',adminNote:'Relevé externe fictif contrôlé',receivedConfirmed:true
   },adminCookie);
   assert.equal(approved.status,200);
   assert.equal((await approved.json()).payment.status,'APPROVED');
  });

  await t.test('Bank account details publish only after activation, with audit tracking',async()=>{
   const configured=await post('/api/admin/payment-reception',validBank(),adminCookie);
   assert.equal(configured.status,200);
   const info=(await (await get('/api/v1/subscription-payments',ownerB)).json());
   assert.deepEqual(info.methods.map((m:{code:string})=>m.code),['BANK_TRANSFER']);
   assert.equal(info.methods[0].bankName,'Banque fictive TEST');
   assert.equal(info.methods[0].identifier,'TEST-RIB-123456789000');
   const payment=await post('/api/v1/subscription-payments',{
    requestId:randomUUID(),planCode:'RECEPTION_TEST',
    method:'BANK_TRANSFER',transferReference:'TEST-BANK-TRANSFER-111',merchantNote:''
   },ownerB);
   assert.equal(payment.status,201);
   assert.equal((await prisma.paymentReceptionAudit.count()),3);
  });

 }finally{
  stopTestServer(server);
  await prisma.$disconnect();
 }
});
