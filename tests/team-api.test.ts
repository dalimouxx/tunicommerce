import test from 'node:test';
import {stopTestServer} from './server-process';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('_test'))throw Error('TEAM tests require dedicated *_test PostgreSQL database');
process.env.DATABASE_URL=url;
const {prisma}=await import('../modules/storage/client');
const {hashPassword}=await import('../modules/auth/crypto');
const base='http://127.0.0.1:3143';
const origin='https://test.local';
const setupToken=randomBytes(32).toString('hex');
const password='Team-Test-password-2026';
let child:ChildProcess|undefined;

const request=(method:string,path:string,cookie='',body:unknown=undefined,from=origin)=>fetch(base+path,{
 method,
 headers:{origin:from,cookie,...(body===undefined?{}:{'content-type':'application/json'})},
 ...(body===undefined?{}:{body:JSON.stringify(body)}),
 redirect:'manual'
});
const post=(path:string,cookie:string,body:unknown)=>request('POST',path,cookie,body);
const patch=(path:string,cookie:string,body:unknown)=>request('PATCH',path,cookie,body);
const get=(path:string,cookie='')=>fetch(base+path,{headers:{cookie}});
async function login(email:string){
 const response=await post('/api/auth/login','',{email,password});
 assert.equal(response.status,200);
 return response.headers.get('set-cookie')!.split(';')[0];
}
async function createUser(email:string){
 return prisma.user.create({data:{email,name:email.split('@')[0],passwordHash:await hashPassword(password)}});
}
async function clearDatabase(){
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
}

test('Invitation acceptance, owner protection and per-shop team isolation over HTTP',async t=>{
 try{
  await clearDatabase();
  child=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3143',DATABASE_URL:url,APP_URL:origin,SETUP_TOKEN:setupToken},
   stdio:'ignore'
  });
  let ready=false;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error('Server exited');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true,'HTTP server ready');

  await t.test('Untrusted users and CSRF cannot operate team endpoints',async()=>{
   assert.equal((await get('/api/v1/invitations')).status,401);
   assert.equal((await post('/api/v1/invitations/123e4567-e89b-42d3-a456-426614174000/accept','',{})).status,401);
   assert.equal((await request('POST','/api/v1/invitations/123e4567-e89b-42d3-a456-426614174000/accept','',{},'https://evil.test')).status,403);
  });

  assert.equal((await post('/api/auth/setup','',{email:'owner@example.test',name:'Owner',password,token:setupToken})).status,201);
  const owner=await prisma.user.findUniqueOrThrow({where:{email:'owner@example.test'}});
  const ownerCookie=await login('owner@example.test');
  await t.test('Team screen is private and available to the signed-in merchant',async()=>{
   const anonymous=await fetch(base+'/equipe',{redirect:'manual'});
   assert.equal(anonymous.status,307);
   assert.ok(anonymous.headers.get('location')?.includes('/connexion/boutique'));
   const authorized=await get('/equipe',ownerCookie);
   assert.equal(authorized.status,200);
   const html=await authorized.text();
   assert.ok(html.includes('Équipe et accès'));
   assert.ok(!html.includes('passwordHash'));
  });

  await createUser('member@example.test');
  await createUser('admin@example.test');
  await createUser('viewer@example.test');
  await createUser('other@example.test');
  const memberCookie=await login('member@example.test');
  const adminCookie=await login('admin@example.test');
  const viewerCookie=await login('viewer@example.test');
  const otherCookie=await login('other@example.test');

  const orgRes=await post('/api/v1/organizations',ownerCookie,{name:'Test Group'});
  assert.equal(orgRes.status,201);
  const orgId=(await orgRes.json()).organization.id as string;
  const shopRes=await post('/api/v1/shops',ownerCookie,{organizationId:orgId,name:'Team Shop',slug:'team-shop'});
  assert.equal(shopRes.status,201);
  const shopId=(await shopRes.json()).shop.id as string;
  const otherShopRes=await post('/api/v1/shops',ownerCookie,{organizationId:orgId,name:'Private Shop',slug:'private-team-shop'});
  assert.equal(otherShopRes.status,201);
  const otherShopId=(await otherShopRes.json()).shop.id as string;
  const invitations='/api/v1/shops/'+shopId+'/invitations';
  const members='/api/v1/shops/'+shopId+'/members';

  await t.test('Owner can create invitations, but other shops cannot see them',async()=>{
   const malicious=await post(invitations,ownerCookie,{email:'member@example.test',role:'OWNER'});
   assert.equal(malicious.status,400);
   assert.equal((await post(invitations,otherCookie,{email:'member@example.test',role:'VIEWER'})).status,403);
   assert.equal((await request('POST',invitations,ownerCookie,{email:'member@example.test',role:'MANAGER'},'https://evil.test')).status,403);
   const result=await post(invitations,ownerCookie,{email:' MEMBER@EXAMPLE.TEST ',role:'MANAGER'});
   assert.equal(result.status,201);
   assert.equal((await result.json()).delivery,'IN_APP_ONLY');
   const pending=await prisma.shopInvitation.findUniqueOrThrow({where:{shopId_email:{shopId,email:'member@example.test'}}});
   assert.equal(pending.role,'MANAGER');
   assert.ok(pending.expiresAt.getTime()>Date.now()+6*86400000);
   const inbox=(await (await get('/api/v1/invitations',memberCookie)).json()).invitations;
   assert.equal(inbox.length,1);
   assert.equal(inbox[0].shop.id,shopId);
   assert.equal((await (await get('/api/v1/invitations',otherCookie)).json()).invitations.length,0);
   assert.equal((await get(invitations,otherCookie)).status,403);
   assert.equal((await get('/api/v1/shops/'+otherShopId+'/invitations',memberCookie)).status,403);
   assert.equal((await get(invitations,ownerCookie)).status,200);
  });

  await t.test('Only the addressed account can accept, and simultaneous submissions apply once',async()=>{
   const invitation=await prisma.shopInvitation.findUniqueOrThrow({where:{shopId_email:{shopId,email:'member@example.test'}}});
   const url='/api/v1/invitations/'+invitation.id+'/accept';
   assert.equal((await post(url,otherCookie,{})).status,404);
   const responses=await Promise.all([post(url,memberCookie,{}),post(url,memberCookie,{})]);
   assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
   assert.equal((await post(url,memberCookie,{})).status,409);
   const membership=await prisma.membership.findUniqueOrThrow({where:{shopId_userId:{shopId,userId:(await prisma.user.findUniqueOrThrow({where:{email:'member@example.test'}})).id}}});
   assert.equal(membership.role,'MANAGER');
   assert.equal(await prisma.membership.count({where:{shopId,userId:membership.userId}}),1);
   assert.equal((await (await get('/api/v1/invitations',memberCookie)).json()).invitations.length,0);
   assert.equal((await get(members,memberCookie)).status,403);
   assert.equal((await post(invitations,ownerCookie,{email:'member@example.test',role:'VIEWER'})).status,409);
  });

  let adminMemberId='';
  await t.test('Owner may invite a shop admin; that admin cannot assign admin access',async()=>{
   const invited=await post(invitations,ownerCookie,{email:'admin@example.test',role:'ADMIN'});
   assert.equal(invited.status,201);
   const invitationId=(await invited.json()).invitation.id;
   assert.equal((await post('/api/v1/invitations/'+invitationId+'/accept',adminCookie,{})).status,201);
   const adminUser=await prisma.user.findUniqueOrThrow({where:{email:'admin@example.test'}});
   adminMemberId=(await prisma.membership.findUniqueOrThrow({where:{shopId_userId:{shopId,userId:adminUser.id}}})).id;
   assert.equal((await post(invitations,adminCookie,{email:'viewer@example.test',role:'ADMIN'})).status,403);
   assert.equal((await post(invitations,adminCookie,{email:'viewer@example.test',role:'VIEWER'})).status,201);
   assert.equal((await get('/api/v1/shops/'+otherShopId+'/members',adminCookie)).status,403);
   const invitationsForOther=await get('/api/v1/shops/'+otherShopId+'/invitations',adminCookie);
   assert.equal(invitationsForOther.status,403);
  });

  await t.test('Revocation, expiry and membership updates enforce least privilege',async()=>{
   const inbox=(await (await get('/api/v1/invitations',viewerCookie)).json()).invitations;
   assert.equal(inbox.length,1);
   const viewerInvite=inbox[0].id as string;
   const revokeUrl=invitations+'/'+viewerInvite+'/revoke';
   assert.equal((await post(revokeUrl,memberCookie,{})).status,403);
   assert.equal((await post(revokeUrl,adminCookie,{})).status,200);
   assert.equal((await post('/api/v1/invitations/'+viewerInvite+'/accept',viewerCookie,{})).status,409);
   assert.equal((await post(revokeUrl,ownerCookie,{})).status,409);
   assert.equal((await post(invitations,ownerCookie,{email:'viewer@example.test',role:'VIEWER'})).status,201);
   const newInvite=await prisma.shopInvitation.findUniqueOrThrow({where:{shopId_email:{shopId,email:'viewer@example.test'}}});
   await prisma.shopInvitation.update({where:{id:newInvite.id},data:{expiresAt:new Date(0)}});
   assert.equal((await post('/api/v1/invitations/'+newInvite.id+'/accept',viewerCookie,{})).status,409);
   assert.equal((await (await get('/api/v1/invitations',viewerCookie)).json()).invitations.length,0);

   const ownerMember=await prisma.membership.findUniqueOrThrow({where:{shopId_userId:{shopId,userId:owner.id}}});
   const memberUser=await prisma.user.findUniqueOrThrow({where:{email:'member@example.test'}});
   const staff=await prisma.membership.findUniqueOrThrow({where:{shopId_userId:{shopId,userId:memberUser.id}}});
   assert.equal((await patch(members+'/'+ownerMember.id,adminCookie,{action:'setActive',active:false})).status,403);
   assert.equal((await patch(members+'/'+adminMemberId,adminCookie,{action:'setRole',role:'OWNER'})).status,400);
   assert.equal((await patch(members+'/'+adminMemberId,adminCookie,{action:'setActive',active:false})).status,403);
   assert.equal((await patch(members+'/'+staff.id,memberCookie,{action:'setRole',role:'ADMIN'})).status,403);
   assert.equal((await patch(members+'/'+staff.id,adminCookie,{action:'setRole',role:'ADMIN'})).status,403);
   assert.equal((await patch(members+'/'+staff.id,ownerCookie,{action:'setRole',role:'CALL_CENTER'})).status,200);
   assert.equal((await patch(members+'/'+staff.id,ownerCookie,{action:'setActive',active:false})).status,200);
   assert.equal((await get('/api/v1/shops',memberCookie)).status,200);
   assert.deepEqual((await (await get('/api/v1/shops',memberCookie)).json()).shops,[]);
   assert.equal((await get(members,memberCookie)).status,403);
   assert.equal((await patch(members+'/'+staff.id,ownerCookie,{action:'setActive',active:true})).status,200);
   const after=await prisma.membership.findUniqueOrThrow({where:{id:staff.id}});
   assert.equal(after.role,'CALL_CENTER');
   assert.equal(after.active,true);
   const ownerAfter=await prisma.membership.findUniqueOrThrow({where:{id:ownerMember.id}});
   assert.equal(ownerAfter.role,'OWNER');
   assert.equal(ownerAfter.active,true);
  });

  await t.test('Subscription staff seats cover all shops and cannot be bypassed by reactivation',async()=>{
   // Provision the existing workspace explicitly; GET is read-only.
   const {readWorkspace}=await import('../modules/storage/repository');
   await readWorkspace(owner.id);
   assert.equal((await get('/api/commerce',ownerCookie)).status,200);
   const workspace=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
   const oldPlan=await prisma.subscriptionPlan.findUniqueOrThrow({where:{code:workspace.plan}});
   const member=await prisma.user.findUniqueOrThrow({where:{email:'member@example.test'}});
   const viewer=await prisma.user.findUniqueOrThrow({where:{email:'viewer@example.test'}});
   try{
    await prisma.subscriptionPlan.update({where:{code:workspace.plan},data:{maxMembers:2}});
    // Two existing active staff (MANAGER + ADMIN) exhaust the plan; OWNER is free.
    assert.equal((await prisma.membership.count({where:{
     active:true,userId:{not:owner.id},shop:{organization:{ownerId:owner.id}}
    }})),2);
    const deniedInvitation=await post('/api/v1/shops/'+otherShopId+'/invitations',ownerCookie,{
     email:'viewer@example.test',role:'VIEWER'
    });
    // Invitations may be issued, but accepting cannot exceed the plan.
    assert.equal(deniedInvitation.status,201);
    const deniedId=(await deniedInvitation.json()).invitation.id as string;
    assert.equal((await post('/api/v1/invitations/'+deniedId+'/accept',viewerCookie,{})).status,409);
    const employee=await prisma.membership.findUniqueOrThrow({where:{shopId_userId:{shopId,userId:member.id}}});
    assert.equal((await patch(members+'/'+employee.id,ownerCookie,{action:'setActive',active:false})).status,200);
    // An invitation rejected for quota is not consumed, and can be accepted later.
    assert.equal((await post('/api/v1/invitations/'+deniedId+'/accept',viewerCookie,{})).status,201);
    assert.equal((await patch(members+'/'+employee.id,ownerCookie,{action:'setActive',active:true})).status,409);
    // Revoke the second shop seat and restore the original employee.
    const viewerMembership=await prisma.membership.findUniqueOrThrow({where:{shopId_userId:{shopId:otherShopId,userId:viewer.id}}});
    assert.equal((await patch('/api/v1/shops/'+otherShopId+'/members/'+viewerMembership.id,ownerCookie,{action:'setActive',active:false})).status,200);
    assert.equal((await patch(members+'/'+employee.id,ownerCookie,{action:'setActive',active:true})).status,200);
    // Existing employee can join another shop of the same owner without consuming a seat.
    const duplicate=await post('/api/v1/shops/'+otherShopId+'/invitations',ownerCookie,{
     email:'member@example.test',role:'STOCK'
    });
    assert.equal(duplicate.status,201);
    const duplicateId=(await duplicate.json()).invitation.id as string;
    assert.equal((await post('/api/v1/invitations/'+duplicateId+'/accept',memberCookie,{})).status,201);
    const all=await prisma.membership.findMany({
     where:{active:true,shop:{organization:{ownerId:owner.id}}},
     select:{userId:true}
    });
    assert.equal(new Set(all.filter(m=>m.userId!==owner.id).map(m=>m.userId)).size,2);
   }finally{
    await prisma.subscriptionPlan.update({where:{code:workspace.plan},data:{maxMembers:oldPlan.maxMembers}});
   }
  });

  await t.test('Existing JSON commerce workspace still operates unchanged',async()=>{
   const legacy=await get('/api/commerce',ownerCookie);
   assert.equal(legacy.status,200);
   const before=(await legacy.json()).state;
   const team=await get(members,ownerCookie);
   assert.equal(team.status,200);
   assert.equal((await team.json()).members.length,3);
   const after=await get('/api/commerce',ownerCookie);
   assert.equal(after.status,200);
   assert.deepEqual((await after.json()).state,before);
  });
 }finally{
  stopTestServer(child);
  await prisma.$disconnect();
 }
});
