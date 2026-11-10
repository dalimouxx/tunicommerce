import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {spawn,type ChildProcess} from 'node:child_process';import {setTimeout as delay} from 'node:timers/promises';import {stopTestServer} from './server-process';
import {applicationRoutes} from '../scripts/application-route-inventory.mjs';
const db=process.env.TEST_DATABASE_URL;if(!db||!new URL(db).pathname.endsWith('_test')||db!==process.env.DATABASE_URL)throw Error('Disposable matching *_test database required');
const {prisma}=await import('../modules/storage/client');const {hashPassword}=await import('../modules/auth/crypto');const {portalSessionHash}=await import('../modules/auth/portal');const {initialState}=await import('../modules/commerce/seed');
const host='http://127.0.0.1:3198',origin='https://audit.local';const unknown='00000000-0000-4000-8000-000000000000';
type Route={path:string;api:boolean;methods:string[];access:string};const routes=applicationRoutes() as Route[];
async function get(path:string,cookie='',rsc=false){const headers={cookie,...(rsc?{RSC:'1'}:{})};let response=await fetch(host+path,{redirect:'manual',headers});const location=response.headers.get('location');if(rsc&&location&&location.startsWith(path+'?_rsc')){await response.arrayBuffer();response=await fetch(host+location,{redirect:'manual',headers});}return response;}
const post=(path:string,body:unknown,cookie='',from=origin,method='POST')=>fetch(host+path,{method,redirect:'manual',headers:{cookie,origin:from,'content-type':'application/json'},body:JSON.stringify(body)});
const internalLinks=new Set<string>();
function collectLinks(body:string){for(const match of body.matchAll(/href="(\/[^"#]*)"/g)){const url=new URL(match[1].replaceAll('&amp;','&'),host);if(url.origin===host&&!url.pathname.startsWith('/_next/')&&url.pathname!=='/favicon.svg')internalLinks.add(url.pathname);}}
const privateValues=['audit-private-a@example.test','audit-private-b@example.test','CLIENT-CONFIDENTIEL-A','ADRESSE-INTERNE-A'];
function noPrivate(body:string,label:string){for(const value of privateValues)assert.equal(body.includes(value),false,label+' leaked '+value);}
test('Complete route inventory: public storefronts, private pages, APIs and tenant boundaries',async t=>{
 let server:ChildProcess|undefined;const ids:string[]=[];
 try{
  const passwordHash=await hashPassword('Audit-Strong-Password-2026!');
  async function account(email:string,role:'ADMIN'|'MERCHANT',workspace=false){const token=randomBytes(32).toString('hex');const state=initialState(false);state.shop.name='CLIENT-CONFIDENTIEL-A';state.shop.address='ADRESSE-INTERNE-A';const user=await prisma.user.create({data:{email,name:'Compte de recette',role,passwordHash,...(workspace?{workspace:{create:{slug:'audit-'+randomBytes(5).toString('hex'),published:false,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000),data:state as never}}}:{})},include:{workspace:true}});ids.push(user.id);await prisma.session.create({data:{userId:user.id,tokenHash:portalSessionHash(token,role==='ADMIN'?'ADMIN':'MERCHANT'),expiresAt:new Date(Date.now()+86400000),authVersion:user.authVersion}});return {...user,cookie:(role==='ADMIN'?'__Host-tunicommerce-admin':'__Host-tunicommerce')+'='+token};}
  const a=await account(privateValues[0],'MERCHANT',true),b=await account(privateValues[1],'MERCHANT',true),admin=await account('audit-platform@example.test','ADMIN'),staff=await account('audit-staff@example.test','MERCHANT');
  const org=await prisma.organization.create({data:{name:'Audit local',ownerId:a.id}});
  const shop=await prisma.shop.create({data:{organizationId:org.id,name:'CLIENT-CONFIDENTIEL-A',slug:'audit-private-isolated',status:'DRAFT',commerce:{create:{data:initialState(false) as never}},memberships:{create:[{userId:a.id,role:'OWNER'},{userId:staff.id,role:'VIEWER'}]}}});
  function concrete(path:string){return path.replace('[shopId]',shop.id).replace('[ownerId]',a.id).replace('[memberId]',staff.id).replace('[pageId]',unknown).replace('[invitationId]',unknown).replace('[productId]','p1').replace('[id]',a.workspace!.id).replace('[token]','0'.repeat(64)).replace('[slug]',shop.slug).replace('[pageSlug]','informations').replace('[slot]','logo').replace('[theme]','PULSE')+(path.endsWith('/team-view')?'?section=orders':'');}
  server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3198',APP_URL:origin,DATABASE_URL:db},stdio:'ignore'});
  let ready=false;for(let i=0;i<160;i++){try{if((await get('/api/health')).ok){ready=true;break;}}catch{}if(server.exitCode!==null)throw Error('Audit server exited');await delay(250);}assert.ok(ready);
  await t.test('every private page rejects anonymous HTML and RSC access without leaking tenant data',async()=>{
   for(const route of routes.filter(r=>!r.api&&r.access!=='public'))for(const rsc of [false,true]){const path=concrete(route.path),r=await get(path,'',rsc);const body=await r.text();noPrivate(body,path);assert.ok([200,307,308].includes(r.status),path+' '+r.status);if(r.status===200)assert.ok(body.includes('NEXT_REDIRECT'),path+' must redirect in RSC');else assert.equal(r.headers.get('location'),route.access==='admin'?'/connexion/admin':'/connexion/boutique',path);}
  });
  await t.test('every global admin page rejects a merchant and loads for an admin before data access',async()=>{
   for(const route of routes.filter(r=>!r.api&&r.access==='admin')){const path=concrete(route.path);const denied=await get(path,a.cookie);noPrivate(await denied.text(),path);assert.equal(denied.status,307,path);assert.equal(denied.headers.get('location'),'/connexion/admin');const allowed=await get(path,admin.cookie);assert.equal(allowed.status,200,path);collectLinks(await allowed.text());assert.match(allowed.headers.get('x-robots-tag')||'',/noindex/);}
  });
  await t.test('every merchant page loads in its authorized context with private headers',async()=>{
   for(const route of routes.filter(r=>!r.api&&r.access==='merchant')){const r=await get(concrete(route.path),a.cookie);const expected=route.path.includes('/justificatif/')||route.path.includes('/[pageId]/')?404:200;assert.equal(r.status,expected,route.path);collectLinks(await r.text());assert.match(r.headers.get('x-robots-tag')||'',/noindex/,route.path);}
  });
  await t.test('all protected API methods reject anonymous and cross-origin calls',async()=>{
   for(const route of routes.filter(r=>r.api&&r.access!=='public'))for(const method of route.methods){const path=concrete(route.path);const r=method==='GET'?await get(path):await post(path,{},'',origin,method);noPrivate(await r.text(),method+' '+path);assert.ok([400,401,403,404,405,415].includes(r.status),method+' '+path+' '+r.status);if(method!=='GET'){const csrf=await post(path,{},a.cookie,'https://evil.example.test',method);assert.equal(csrf.status,403,'CSRF '+method+' '+path);await csrf.arrayBuffer();}}
  });
  await t.test('other merchants cannot read or alter private shop pages and APIs',async()=>{
   for(const route of routes.filter(r=>r.path.startsWith('/mes-boutiques/[shopId]'))){const r=await get(concrete(route.path),b.cookie);noPrivate(await r.text(),route.path);assert.equal(r.status,404,route.path);}
   for(const route of routes.filter(r=>r.path.startsWith('/api/v1/shops/[shopId]')&&r.methods.includes('GET'))){const r=await get(concrete(route.path),b.cookie);noPrivate(await r.text(),route.path);assert.ok([403,404].includes(r.status),route.path+' '+r.status);}
   const before=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:shop.id}});for(const cookie of [b.cookie,admin.cookie,staff.cookie]){const r=await post('/api/v1/shops/'+shop.id+'/commerce',{action:'initialize'},cookie);assert.ok([401,403,404].includes(r.status));await r.arrayBuffer();}assert.deepEqual((await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:shop.id}})).data,before.data);
  });
  await t.test('staff and platform-only sessions cannot provision a legacy workspace by reading its API',async()=>{
   const before=await prisma.workspace.count();for(const cookie of [staff.cookie,admin.cookie])for(const path of ['/api/commerce','/api/v1/commerce'])assert.ok([401,403].includes((await get(path,cookie)).status));assert.equal(await prisma.workspace.count(),before);
   const staffPage=await get('/marchand',staff.cookie);assert.equal(staffPage.headers.get('location'),'/equipe');
  });
  await t.test('public navigation stays in the merchant portal, and draft storefronts stay private',async()=>{
   const login=await get('/connexion/boutique');const html=await login.text();assert.equal(html.includes('href="/connexion/admin"'),false);assert.equal(html.includes('href="/setup"'),false);assert.equal((await get('/connexion')).headers.get('location'),'/connexion/boutique');assert.equal((await get('/login')).headers.get('location'),'/connexion/boutique');
   for(const path of ['/vitrines/'+shop.slug,'/boutiques/'+a.workspace!.slug])assert.equal((await get(path)).status,404);
   for(const path of ['/','/decouvrir','/boutiques','/themes/PULSE','/themes/SORBET','/themes/CHROME','/themes/GROOVE','/inscription','/compte/recuperer','/compte/reinitialiser','/compte/verifier']){const r=await get(path);assert.equal(r.status,200,path);const publicBody=await r.text();noPrivate(publicBody,path);collectLinks(publicBody);}
  });
  await t.test('rendered internal navigation targets known application routes',()=>{
   const patterns=routes.map(route=>new RegExp('^'+route.path.split('/').map(segment=>segment.startsWith('[')?'[^/]+':segment.replace(/[.*+?^$()|{}\\]/g,character=>'\\'+character)).join('/')+'/?$'));
   for(const path of internalLinks)assert.ok(patterns.some(pattern=>pattern.test(path)),'Broken internal route: '+path);assert.ok(internalLinks.size>20);
  });
  await t.test('expired and revoked cookies, including forged portal cookie names, cannot cross boundaries',async()=>{
   const stolen=a.cookie.replace('__Host-tunicommerce=','__Host-tunicommerce-admin=');assert.equal((await get('/api/admin/plans',stolen)).status,401);
   await prisma.session.updateMany({where:{userId:a.id},data:{expiresAt:new Date(Date.now()-1000)}});assert.equal((await get('/api/commerce',a.cookie)).status,401);
   await prisma.session.deleteMany({where:{userId:b.id}});assert.equal((await get('/mes-boutiques',b.cookie)).headers.get('location'),'/connexion/boutique');
  });
  console.log(JSON.stringify({internalLinkTargets:internalLinks.size,inventoryPages:routes.filter(r=>!r.api).length,inventoryApis:routes.filter(r=>r.api).length,privatePageTemplates:routes.filter(r=>!r.api&&r.access!=='public').length,protectedApiMethods:routes.filter(r=>r.api&&r.access!=='public').reduce((n,r)=>n+r.methods.length,0)}));
 }finally{stopTestServer(server);await prisma.organization.deleteMany({where:{ownerId:{in:ids}}});await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect();}
});


