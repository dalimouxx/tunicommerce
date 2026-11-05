import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test'))
 throw Error('Billing regression must use a dedicated *_test PostgreSQL database');
process.env.DATABASE_URL=database;
const {prisma}=await import('../modules/storage/client');
const base='http://127.0.0.1:3182';
const origin='https://test.local';
const password='Billing-Verified-Manual-2026!';
const setupToken=randomBytes(32).toString('hex');
let child:ChildProcess|undefined;

function get(path:string,cookie=''){
 return fetch(base+path,{headers:{cookie},redirect:'manual'});
}
function post(path:string,body:unknown,cookie='',requestOrigin=origin){
 return fetch(base+path,{method:'POST',
  headers:{cookie,origin:requestOrigin,'content-type':'application/json'},
  body:JSON.stringify(body),redirect:'manual'});
}
function claim(requestId:string,reference='D17-ORIGINAL-2026'){
 return {requestId,planCode:'BILLING_TEST',method:'D17',
  transferReference:reference,merchantNote:'Transfert externe déclaré'};
}
function decision(id:string,action:'approve'|'reject',adminNote='Réception vérifiée dans les relevés'){
 return {id,action,adminNote};
}
async function clean(){
 await prisma.paymentReceptionAudit.deleteMany();
 await prisma.paymentReceptionMethod.updateMany({data:{
  enabled:false,recipientName:'',identifier:'',bankName:'',instructions:'',
  version:0,updatedById:null
 }});
 await prisma.subscriptionPayment.deleteMany();
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
 await prisma.subscriptionPlan.deleteMany({where:{code:'BILLING_TEST'}});
}
const modules={
 callCenter:false,marketing:false,analytics:false,aiCopilot:false,
 customDomain:false,multiShop:false
};

test('Offline SaaS billing: merchant claims, admin reconciliation, audit, receipt and no double renewal',async t=>{
 try{
  await clean();
  child=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3182',DATABASE_URL:database,
    APP_URL:origin,SETUP_TOKEN:setupToken},stdio:'ignore'
  });
  let ready=false;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error('Next production server crashed');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true,'Production server started');

  await t.test('Anonymous and cross-origin billing requests are rejected',async()=>{
   assert.equal((await get('/api/v1/subscription-payments')).status,401);
   assert.equal((await get('/api/admin/subscription-payments')).status,401);
   assert.equal((await post('/api/v1/subscription-payments',claim(randomUUID()))).status,401);
   assert.equal((await post('/api/admin/subscription-payments',decision(randomUUID(),'approve'))).status,401);
   assert.equal((await get('/admin/paiements')).status,307);
   assert.equal((await get('/mon-abonnement/justificatif/'+randomUUID())).status,307);
  });

  assert.equal((await post('/api/auth/setup',{
   name:'Opérateur TuniCommerce',email:'admin@example.test',password,token:setupToken
  })).status,201);
  const adminLogin=await post('/api/auth/admin/login',{email:'admin@example.test',password});
  assert.equal(adminLogin.status,200);
  const adminCookie=adminLogin.headers.get('set-cookie')!.split(';')[0];
  const plan={
   code:'BILLING_TEST',name:'Essai facturation',description:'Test paiement manuel',
   priceMillimes:69000,durationDays:15,maxProducts:null,maxOrdersPerMonth:null,
   maxPhotos:null,maxShops:null,maxMembers:null,modules,enabled:true
  };
  assert.equal((await post('/api/admin/plans',plan,adminCookie)).status,200);

  async function register(email:string,slug:string){
   const response=await post('/api/auth/register',{
    name:'Commerçant test',email,password,shopName:slug,slug
   });
   assert.equal(response.status,201);
   return response.headers.get('set-cookie')!.split(';')[0];
  }
  const merchantA=await register('merchant-a@example.test','merchant-billing-a');
  const merchantB=await register('merchant-b@example.test','merchant-billing-b');
  const ownerA=await prisma.user.findUniqueOrThrow({where:{email:'merchant-a@example.test'}});
  const ownerB=await prisma.user.findUniqueOrThrow({where:{email:'merchant-b@example.test'}});
  const workspaceA=await prisma.workspace.findUniqueOrThrow({where:{ownerId:ownerA.id}});
  const workspaceB=await prisma.workspace.findUniqueOrThrow({where:{ownerId:ownerB.id}});

  await t.test('Payment methods are disabled by default, then only official configured methods can be declared',async()=>{
   const disabled=await post('/api/v1/subscription-payments',
    claim(randomUUID()),merchantA);
   assert.equal(disabled.status,409,'No declarations before configuring official recipient');
   const before=(await (await get('/api/v1/subscription-payments',merchantA)).json()).methods;
   assert.equal(before.length,0);
   assert.equal((await get('/api/admin/payment-reception',merchantA)).status,401);
   assert.equal((await post('/api/admin/payment-reception',{
    code:'D17',version:0,enabled:true,recipientName:'Compte test du bénéficiaire',
    identifier:'TEST-ONLY-D17-123',bankName:'',
    instructions:'Test seulement : virement simulé en environnement PostgreSQL isolé.'
   },merchantA)).status,401);
   const setupD17=await post('/api/admin/payment-reception',{
    code:'D17',version:0,enabled:true,recipientName:'Compte test du bénéficiaire',
    identifier:'TEST-ONLY-D17-123',bankName:'',
    instructions:'Test seulement : virement simulé en environnement PostgreSQL isolé.'
   },adminCookie);
   assert.equal(setupD17.status,200);
   const cashSetup=await post('/api/admin/payment-reception',{
    code:'CASH',version:0,enabled:true,recipientName:'Caissier de test',
    identifier:'',bankName:'',
    instructions:'Remise fictive au guichet de test uniquement.'
   },adminCookie);
   assert.equal(cashSetup.status,200);
   assert.equal((await prisma.paymentReceptionAudit.count()),2);
   const methods=(await (await get('/api/v1/subscription-payments',merchantA)).json()).methods;
   assert.equal(methods.length,2);
   assert.ok(methods.some((m:{code:string})=>m.code==='D17'));
   assert.ok(methods.some((m:{code:string})=>m.code==='CASH'));
   assert.equal(methods.some((m:{code:string})=>m.code==='BANK_TRANSFER'),false);
  });


  let firstId='';
  let firstDocument='';
  await t.test('Merchant can declare D17 once, cannot change the plan or expiry, and cannot access other data',async()=>{
   const requestId=randomUUID();
   assert.equal((await post('/api/v1/subscription-payments',
    claim(requestId),merchantA,'https://evil.test')).status,403);
   assert.equal((await post('/api/v1/subscription-payments',
    {...claim(requestId),transferReference:'bad'},merchantA)).status,400);
   const response=await post('/api/v1/subscription-payments',claim(requestId),merchantA);
   assert.equal(response.status,201);
   const data=await response.json();
   firstId=data.payment.id;
   firstDocument='/mon-abonnement/justificatif/'+firstId;
   assert.equal(data.payment.reference.startsWith('TC-AB-'),true);
   assert.equal(data.payment.status,'PENDING');
   assert.equal(data.payment.priceMillimes,69000);
   const after=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceA.id}});
   assert.equal(after.plan,'STARTER');
   assert.equal(after.subscriptionStatus,'TRIAL');
   assert.equal(after.subscriptionEndsAt?.getTime(),workspaceA.subscriptionEndsAt?.getTime());
   assert.equal((await get(firstDocument,merchantA)).status,200);
   assert.equal((await get(firstDocument,merchantB)).status,404);
   assert.equal((await get('/api/v1/subscription-payments',merchantB)).status,200);
   assert.equal(((await (await get('/api/v1/subscription-payments',merchantB)).json()).payments.length),0);
   assert.equal((await get('/admin/paiements',merchantA)).status,307);
   assert.equal((await post('/api/admin/subscription-payments',decision(firstId,'approve'),merchantA)).status,401);
   const again=await post('/api/v1/subscription-payments',claim(requestId),merchantA);
   assert.equal(again.status,200);
   assert.equal((await again.json()).alreadySubmitted,true);
   assert.equal((await post('/api/v1/subscription-payments',
    {...claim(requestId),merchantNote:'Other'},merchantA)).status,409);
   assert.equal((await post('/api/v1/subscription-payments',
    claim(randomUUID(),'D17-OTHER-2026'),merchantA)).status,409);
   assert.equal(await prisma.subscriptionPayment.count({where:{workspaceId:workspaceA.id}}),1);
   const adminPage=await get('/admin/paiements',adminCookie);
   assert.equal(adminPage.status,200);
   assert.ok((await adminPage.text()).includes('Règlements et renouvellements'));
  });

  await t.test('Admin rejection requires reason and does not change any subscription',async()=>{
   assert.equal((await post('/api/admin/subscription-payments',
    decision(firstId,'reject',''),adminCookie)).status,400);
   assert.equal((await post('/api/admin/subscription-payments',
    decision(firstId,'reject'),adminCookie,'https://evil.test')).status,403);
   const reject=await post('/api/admin/subscription-payments',
    decision(firstId,'reject','Référence non retrouvée'),adminCookie);
   assert.equal(reject.status,200);
   assert.equal((await reject.json()).payment.status,'REJECTED');
   const row=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceA.id}});
   assert.equal(row.plan,'STARTER');
   assert.equal(row.subscriptionEndsAt?.getTime(),workspaceA.subscriptionEndsAt?.getTime());
   assert.equal((await post('/api/admin/subscription-payments',
    decision(firstId,'approve'),adminCookie)).status,409);
   const document=await (await get(firstDocument,merchantA)).text();
   assert.ok(document.includes('Référence non retrouvée'));
  });

  let approvedId='';
  await t.test('Plan and amount snapshot do not change after merchant submits a second request',async()=>{
   const response=await post('/api/v1/subscription-payments',
    claim(randomUUID(),'D17-SNAPSHOT-2026'),merchantA);
   assert.equal(response.status,201);
   approvedId=(await response.json()).payment.id;
   assert.equal((await post('/api/admin/plans',{
    ...plan,priceMillimes:159000,durationDays:30
   },adminCookie)).status,200);
   const old=await prisma.subscriptionPayment.findUniqueOrThrow({where:{id:approvedId}});
   assert.equal(old.priceMillimes,69000);
   assert.equal(old.durationDays,15);
  });

  await t.test('Two admin approvals are idempotent, extend expiry only once and preserve commercial data',async()=>{
   const prior=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceA.id}});
   const response=await post('/api/admin/subscription-payments',
    decision(approvedId,'approve'),adminCookie);
   assert.equal(response.status,200);
   const data=await response.json();
   assert.equal(data.payment.status,'APPROVED');
   assert.equal(data.payment.priceMillimes,69000);
   assert.equal(data.payment.durationDays,15);
   const after=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceA.id}});
   assert.equal(after.plan,'BILLING_TEST');
   assert.equal(after.subscriptionStatus,'ACTIVE');
   assert.equal(after.data===null,false);
   const expectedMs=Math.max(Date.now(),prior.subscriptionEndsAt?.getTime()||0)+15*86400000;
   assert.ok(Math.abs((after.subscriptionEndsAt?.getTime()||0)-expectedMs)<5000);
   const second=await post('/api/admin/subscription-payments',
    decision(approvedId,'approve'),adminCookie);
   assert.equal(second.status,200);
   assert.equal((await second.json()).alreadyDecided,true);
   const final=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceA.id}});
   assert.equal(final.subscriptionEndsAt?.getTime(),after.subscriptionEndsAt?.getTime());
   assert.deepEqual(final.data,prior.data,'Merchant products/orders/COD unchanged');
   assert.equal((await get('/mon-abonnement',merchantA)).status,200);
   const receipt=await get('/mon-abonnement/justificatif/'+approvedId,merchantA);
   assert.equal(receipt.status,200);
   assert.ok((await receipt.text()).includes('Attestation de validation administrative'));
  });

  await t.test('Duplicate externally verified D17 reference cannot validate a second merchant',async()=>{
   const copied=await post('/api/v1/subscription-payments',
    claim(randomUUID(),'D17-SNAPSHOT-2026'),merchantB);
   assert.equal(copied.status,201);
   const copiedId=(await copied.json()).payment.id;
   const rejectedApproval=await post('/api/admin/subscription-payments',
    decision(copiedId,'approve'),adminCookie);
   assert.equal(rejectedApproval.status,409,'Unique approved external transfer prevents duplicate credit');
   assert.equal((await prisma.subscriptionPayment.findUniqueOrThrow({where:{id:copiedId}})).status,'PENDING');
   const unchanged=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceB.id}});
   assert.equal(unchanged.plan,'STARTER');
   assert.equal(unchanged.subscriptionStatus,'TRIAL');
   assert.equal((await post('/api/admin/subscription-payments',
    decision(copiedId,'reject','Référence de transfert déjà validée'),adminCookie)).status,200);
  });

  await t.test('Cash declaration also requires manual approval, logs an audit and supports a private document',async()=>{
   const response=await post('/api/v1/subscription-payments',{
    requestId:randomUUID(),planCode:'BILLING_TEST',
    method:'CASH',transferReference:'',merchantNote:'Remise en main propre'
   },merchantB);
   assert.equal(response.status,201);
   const cashId=(await response.json()).payment.id;
   assert.equal((await prisma.workspace.findUniqueOrThrow({where:{id:workspaceB.id}})).plan,'STARTER');
   assert.equal((await post('/api/admin/subscription-payments',
    decision(cashId,'approve','Espèces reçues et comptées'),adminCookie)).status,200);
   const after=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceB.id}});
   assert.equal(after.plan,'BILLING_TEST');
   assert.equal(after.subscriptionStatus,'ACTIVE');
   const document=await get('/mon-abonnement/justificatif/'+cashId,merchantB);
   assert.equal(document.status,200);
   assert.ok((await document.text()).includes('ne constitue pas une facture fiscale'));
   assert.equal((await get('/mon-abonnement/justificatif/'+cashId,merchantA)).status,404);
   const approvals=await prisma.platformAudit.findMany({where:{detail:{contains:'subscription_payment_approved'}}});
   assert.equal(approvals.length,2);
   assert.equal(await prisma.subscriptionPayment.count({where:{status:'APPROVED'}}),2);
  });

 }finally{
  child?.kill('SIGTERM');
  await prisma.$disconnect();
 }
});
