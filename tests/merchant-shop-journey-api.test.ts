import test from 'node:test';import assert from 'node:assert/strict';import {spawn,type ChildProcess} from 'node:child_process';import {randomUUID} from 'node:crypto';import {setTimeout as delay} from 'node:timers/promises';import {stopTestServer} from './server-process';
const db=process.env.TEST_DATABASE_URL;if(!db||db!==process.env.DATABASE_URL||!new URL(db).pathname.endsWith('_test'))throw Error('Disposable matching *_test database required');
const {prisma}=await import('../modules/storage/client');const host='http://127.0.0.1:3201',origin='https://journey.test.local';
const get=(path:string,cookie='')=>fetch(host+path,{redirect:'manual',headers:{cookie}});
const post=(path:string,body:unknown,cookie='',from=origin)=>fetch(host+path,{method:'POST',redirect:'manual',headers:{cookie,origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('Merchant creates, prepares and publishes an independent shop without crossing tenant or quota boundaries',async t=>{
 let server:ChildProcess|undefined;const userIds:string[]=[];const stamp=randomUUID().slice(0,8);const plan=await prisma.subscriptionPlan.findUniqueOrThrow({where:{code:'PRO'}});
 try{
  await prisma.subscriptionPlan.update({where:{code:'PRO'},data:{maxShops:3,enabled:true}});
  server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3201',APP_URL:origin,DATABASE_URL:db},stdio:'ignore'});
  let ready=false;for(let n=0;n<160;n++){try{if((await get('/api/health')).ok){ready=true;break;}}catch{}if(server.exitCode!==null)throw Error('Journey server exited');await delay(250);}assert.ok(ready);
  async function register(label:string){const email='journey-'+label+'-'+stamp+'@example.test';const r=await post('/api/auth/register',{name:'Compte '+label,email,password:'Journey-Strong-2026!',shopName:'Historique '+label,slug:'journey-'+label+'-'+stamp});assert.equal(r.status,201);const cookie=r.headers.get('set-cookie')!.split(';')[0];const user=await prisma.user.findUniqueOrThrow({where:{email},include:{workspace:true,ownedOrganizations:true}});userIds.push(user.id);return {...user,cookie};}
  const a=await register('a'),b=await register('b');await prisma.workspace.update({where:{ownerId:a.id},data:{plan:'PRO',subscriptionStatus:'ACTIVE'}});
  const historical=await prisma.workspace.findUniqueOrThrow({where:{ownerId:a.id}});let groupId='',shopId='';const slug='journey-isolated-'+stamp;
  await t.test('creation form requires a merchant session and contains only owned groups',async()=>{
   assert.equal((await get('/mes-boutiques/nouvelle')).headers.get('location'),'/connexion/boutique');const page=await get('/mes-boutiques/nouvelle',a.cookie);assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('Créer ma boutique en brouillon'));assert.equal(html.includes(b.ownedOrganizations[0].id),false);assert.ok(html.includes(a.ownedOrganizations[0].id));
  });
  await t.test('group and draft creation enforce owner scope and reject CSRF',async()=>{
   assert.equal((await post('/api/v1/organizations',{name:'Mon studio'},a.cookie,'https://evil.test')).status,403);
   const group=await post('/api/v1/organizations',{name:'Studio '+stamp},a.cookie);assert.equal(group.status,201);groupId=(await group.json()).organization.id;
   assert.equal((await post('/api/v1/shops',{organizationId:groupId,name:'Intrusion',slug:'intrusion-'+stamp},b.cookie)).status,403);
   const created=await post('/api/v1/shops',{organizationId:groupId,name:'Studio indépendant',slug},a.cookie);assert.equal(created.status,201);const shop=(await created.json()).shop;shopId=shop.id;assert.equal(shop.status,'DRAFT');assert.equal(await prisma.shopCommerce.count({where:{shopId}}),0);
   assert.equal((await post('/api/v1/shops',{organizationId:groupId,name:'Doublon',slug},a.cookie)).status,409);assert.equal((await get('/vitrines/'+slug)).status,404);assert.deepEqual((await prisma.workspace.findUniqueOrThrow({where:{id:historical.id}})).data,historical.data);
  });
  await t.test('initialization and launch steps guide an empty catalogue without publishing it',async()=>{
   const before=await (await get('/mes-boutiques/'+shopId,a.cookie)).text();assert.ok(before.includes('Prépare ta boutique'));assert.ok(before.includes('Activer mon espace commercial'));
   assert.equal((await post('/api/v1/shops/'+shopId+'/commerce',{action:'initialize'},a.cookie)).status,200);assert.equal((await post('/api/v1/shops/'+shopId+'/commerce',{action:'initialize'},a.cookie)).status,200);
   const state=(await (await get('/api/v1/shops/'+shopId+'/commerce',a.cookie)).json()).state;assert.equal(state.products.length,0);assert.equal(state.orders.length,0);assert.equal(state.shop.address,'');
   assert.equal((await get('/mes-boutiques/'+shopId+'/apercu',a.cookie)).status,200);assert.equal((await get('/mes-boutiques/'+shopId+'/apercu',b.cookie)).status,404);assert.equal((await post('/api/v1/shops/'+shopId+'/publication',{published:true},a.cookie)).status,409);
  });
  await t.test('active product enables explicit publication and the directory shows its real public link',async()=>{
   const added=await post('/api/v1/shops/'+shopId+'/inventory',{action:'product',requestId:randomUUID(),payload:{name:'Article du studio',sku:'STUDIO-01',category:'Mode',variant:'M',price:30000,cost:12000,stock:4,threshold:1,color:'#c9ff4a'}},a.cookie);assert.equal(added.status,200);
   const ready=await (await get('/mes-boutiques/'+shopId,a.cookie)).text();assert.ok(ready.includes('Ta boutique est prête'));
   assert.equal((await post('/api/v1/shops/'+shopId+'/publication',{published:true},a.cookie)).status,200);assert.equal((await get('/vitrines/'+slug)).status,200);
   const directory=await (await get('/mes-boutiques',a.cookie)).text();assert.ok(directory.includes('href="/vitrines/'+slug+'"'));assert.ok(directory.includes('Aperçu privé'));
   await prisma.workspace.update({where:{ownerId:a.id},data:{subscriptionStatus:'SUSPENDED'}});assert.equal((await get('/vitrines/'+slug)).status,404);assert.equal((await (await get('/mes-boutiques',a.cookie)).text()).includes('href="/vitrines/'+slug+'"'),false);
   await prisma.workspace.update({where:{ownerId:a.id},data:{subscriptionStatus:'ACTIVE'}});
  });
  await t.test('simultaneous shop creation never exceeds the owner-wide quota',async()=>{
   const responses=await Promise.all(['one','two'].map(label=>post('/api/v1/shops',{organizationId:groupId,name:'Nouvelle '+label,slug:'journey-'+label+'-'+stamp},a.cookie)));assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);for(const r of responses)await r.arrayBuffer();assert.equal(await prisma.shop.count({where:{organization:{ownerId:a.id}}}),3);
   const full=await (await get('/mes-boutiques/nouvelle',a.cookie)).text();assert.ok(full.includes('Création actuellement indisponible'));assert.equal(full.includes('Créer ma boutique en brouillon'),false);
  });
  await t.test('group creation is also serialized at its ten-group limit',async()=>{
   const count=await prisma.organization.count({where:{ownerId:a.id}});for(let i=count;i<9;i++)await prisma.organization.create({data:{ownerId:a.id,name:'Groupe '+i}});
   const responses=await Promise.all(['A','B'].map(name=>post('/api/v1/organizations',{name:'Dernier '+name},a.cookie)));assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);for(const r of responses)await r.arrayBuffer();assert.equal(await prisma.organization.count({where:{ownerId:a.id}}),10);
   assert.deepEqual((await prisma.workspace.findUniqueOrThrow({where:{id:historical.id}})).data,historical.data);
  });
 }finally{stopTestServer(server);await prisma.organization.deleteMany({where:{ownerId:{in:userIds}}});await prisma.user.deleteMany({where:{id:{in:userIds}}});await prisma.subscriptionPlan.update({where:{code:'PRO'},data:{maxShops:plan.maxShops,enabled:plan.enabled}});await prisma.$disconnect();}
});
