import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {stopTestServer} from './server-process';
import {initialHomeContent,type HomeEditorRecord} from '../modules/shops/home-content';
const db=process.env.TEST_DATABASE_URL;
if(!db||db!==process.env.DATABASE_URL||!new URL(db).pathname.endsWith('_test'))throw Error('Matching disposable *_test database required');
const {prisma}=await import('../modules/storage/client');
const {initialState}=await import('../modules/commerce/seed');
const {portalSessionHash}=await import('../modules/auth/portal');
const base='http://127.0.0.1:3204',origin='https://home.example.test';
const get=(path:string,cookie='')=>fetch(base+path,{redirect:'manual',headers:{cookie}});
const put=(path:string,body:unknown,cookie='',from=origin)=>fetch(base+path,{method:'PUT',redirect:'manual',headers:{cookie,origin:from,'content-type':'application/json'},body:JSON.stringify(body)});

test('Homepage editor: private drafts, bilingual publication, version conflicts and safe theme fallback',async t=>{
 const ids:string[]=[],mark=randomBytes(4).toString('hex');let server:ChildProcess|undefined;
 try{
  async function owner(label:string){
   const token=randomBytes(32).toString('hex'),state=initialState(false);state.shop.name='Boutique accueil '+label;state.products=initialState(true).products.slice(0,1);
   const user=await prisma.user.create({data:{email:'home-'+label+'-'+mark+'@example.test',name:'Compte de recette',passwordHash:'unused',workspace:{create:{plan:'PRO',subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000),data:initialState(false) as never}}}});ids.push(user.id);
   await prisma.session.create({data:{userId:user.id,tokenHash:portalSessionHash(token,'MERCHANT'),authVersion:user.authVersion,expiresAt:new Date(Date.now()+86400000)}});
   const org=await prisma.organization.create({data:{ownerId:user.id,name:'Organisation accueil'}});
   const shop=await prisma.shop.create({data:{organizationId:org.id,name:state.shop.name,slug:'home-'+label+'-'+mark,status:'PUBLISHED',commerce:{create:{data:state as never}},memberships:{create:{userId:user.id,role:'OWNER'}}}});
   return {user,shop,cookie:'__Host-tunicommerce='+token};
  }
  const a=await owner('a'),b=await owner('b');const endpoint='/api/v1/shops/'+a.shop.id+'/home',publicPath='/vitrines/'+a.shop.slug,preview='/mes-boutiques/'+a.shop.id+'/apercu';
  const commerceBefore=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.shop.id}});const workspaceBefore=await prisma.workspace.findUniqueOrThrow({where:{ownerId:a.user.id}});
  server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3204',APP_URL:origin,DATABASE_URL:db,STOREFRONT_DOMAIN_ROUTING:'disabled'},stdio:'ignore'});
  let ready=false;for(let n=0;n<160;n++){try{if((await get('/api/health')).ok){ready=true;break;}}catch{}if(server.exitCode!==null)throw Error('Home server exited');await delay(250);}assert.ok(ready);
  let record:HomeEditorRecord;const draft=initialHomeContent();draft.fr.heroTitle='BROUILLON-PRIVE-'+mark;draft.fr.heroDescription='Présentation confidentielle';draft.fr.announcement='Annonce FR '+mark;
  draft.fr.sections=[{id:randomUUID(),type:'text',title:'SECTION-FR-'+mark,text:'Texte sûr <script>alert(1)</script>'},{id:randomUUID(),type:'cta',title:'Découvrez la collection',text:'Articles disponibles',label:'Voir le catalogue'}];
  draft.ar.heroTitle='مرحبا '+mark;draft.ar.sections=[{id:randomUUID(),type:'faq',title:'أسئلة '+mark,items:[{question:'كيف أطلب؟',answer:'اختر المنتج'}]}];
  async function change(action:'save'|'publish'|'unpublish'|'restore',content?:unknown){const response=await put(endpoint,{action,version:record.version,...(action==='save'?{content}:{})},a.cookie);if(response.ok)record=await response.json();return response;}
  await t.test('owner reads are private and never provision a homepage',async()=>{
   assert.equal((await get(endpoint)).status,401);assert.equal((await get(endpoint,b.cookie)).status,404);assert.equal((await get('/mes-boutiques/'+a.shop.id+'/accueil',a.cookie)).status,200);assert.equal((await get('/mes-boutiques/'+a.shop.id+'/accueil',b.cookie)).status,404);
   record=await (await get(endpoint,a.cookie)).json();assert.equal(record.version,0);assert.equal(await prisma.shopHome.count({where:{shopId:a.shop.id}}),0);
  });
  await t.test('forged origins, invalid shapes and oversized bodies cannot write drafts',async()=>{
   assert.equal((await put(endpoint,{action:'save',version:0,content:draft},a.cookie,'https://evil.test')).status,403);
   assert.equal((await put(endpoint,{action:'save',version:0,content:{...draft,css:'unsafe'}},a.cookie)).status,400);
   assert.equal((await put(endpoint,{action:'save',version:0,content:{...draft,fr:{...draft.fr,heroTitle:'x'.repeat(45000)}}},a.cookie)).status,413);assert.equal(await prisma.shopHome.count({where:{shopId:a.shop.id}}),0);
  });
  await t.test('two initial writes serialize and only one expected version succeeds',async()=>{
   const responses=await Promise.all([put(endpoint,{action:'save',version:0,content:draft},a.cookie),put(endpoint,{action:'save',version:0,content:draft},a.cookie)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);record=await responses.find(r=>r.ok)!.json();assert.equal(record.version,1);assert.equal(record.hasUnpublishedChanges,true);
  });
  await t.test('saved drafts are visible only in owner preview, including Arabic, without executable HTML',async()=>{
   const live=await (await get(publicPath+'?lang=fr')).text();assert.equal(live.includes(draft.fr.heroTitle),false);
   const html=await (await get(preview,a.cookie)).text();assert.ok(html.includes(draft.fr.heroTitle));assert.ok(html.includes('&lt;script&gt;'));assert.equal(html.includes('<script>alert(1)</script>'),false);assert.equal((await get(preview,b.cookie)).status,404);
   const arabic=await (await get(preview+'?lang=ar',a.cookie)).text();assert.ok(arabic.includes(draft.ar.heroTitle));assert.ok(arabic.includes('dir="rtl"'));
  });
  await t.test('publication checks shop status and subscription, then publishes both language snapshots',async()=>{
   await prisma.shop.update({where:{id:a.shop.id},data:{status:'DRAFT'}});assert.equal((await change('publish')).status,409);assert.equal((await get(preview,a.cookie)).status,200);await prisma.shop.update({where:{id:a.shop.id},data:{status:'PUBLISHED'}});
   await prisma.workspace.update({where:{ownerId:a.user.id},data:{subscriptionEndsAt:new Date(Date.now()-1000)}});assert.equal((await change('publish')).status,409);await prisma.workspace.update({where:{ownerId:a.user.id},data:{subscriptionEndsAt:new Date(Date.now()+86400000)}});
   assert.equal((await change('publish')).status,200);assert.equal(record.hasUnpublishedChanges,false);
   const fr=await (await get(publicPath+'?lang=fr')).text(),ar=await (await get(publicPath+'?lang=ar')).text();assert.ok(fr.includes(draft.fr.heroTitle));assert.ok(fr.includes('SECTION-FR-'+mark));assert.equal(fr.includes(draft.ar.heroTitle),false);assert.ok(ar.includes(draft.ar.heroTitle));assert.equal(ar.includes(draft.fr.heroTitle),false);
  });
  await t.test('new saves keep the public snapshot stable; restore does not publish or overwrite commerce',async()=>{
   const changed=structuredClone(draft);changed.fr.heroTitle='NOUVEAU-BROUILLON-'+mark;assert.equal((await change('save',changed)).status,200);assert.equal(record.hasUnpublishedChanges,true);
   let html=await (await get(publicPath+'?lang=fr')).text();assert.ok(html.includes(draft.fr.heroTitle));assert.equal(html.includes(changed.fr.heroTitle),false);
   assert.equal((await change('restore')).status,200);assert.equal(record.draft.fr.heroTitle,draft.fr.heroTitle);assert.equal(record.hasUnpublishedChanges,false);
   changed.sectionsPosition='afterCatalog';changed.showBenefits=false;changed.fr.sections.reverse();assert.equal((await change('save',changed)).status,200);assert.equal((await change('publish')).status,200);
   html=await (await get(publicPath+'?lang=fr')).text();assert.ok(html.includes(changed.fr.heroTitle));assert.ok(html.indexOf('data-section-type=')>html.indexOf('id="catalogue"'));assert.ok(html.indexOf('Découvrez la collection')<html.indexOf('SECTION-FR-'+mark));
  });
  await t.test('stale versions and foreign owners cannot replace the saved home',async()=>{
   for(const action of ['save','publish','restore','unpublish'])assert.equal((await put(endpoint,{action,version:0,...(action==='save'?{content:draft}:{})},a.cookie)).status,409);
   assert.equal((await put(endpoint,{action:'save',version:record.version,content:draft},b.cookie)).status,404);const other=await (await get('/api/v1/shops/'+b.shop.id+'/home',b.cookie)).json();assert.equal(other.version,0);assert.equal((await get('/vitrines/'+b.shop.slug)).status,200);
  });
  await t.test('theme fallback retains the draft; subscription suspension still blocks the public shop',async()=>{
   const kept=structuredClone(record.draft);assert.equal((await change('unpublish')).status,200);assert.equal(record.publishedAt,null);assert.deepEqual(record.draft,kept);const html=await (await get(publicPath+'?lang=fr')).text();assert.equal(html.includes(kept.fr.heroTitle),false);assert.ok(html.includes('Boutique accueil a'));
   assert.equal((await change('publish')).status,200);await prisma.workspace.update({where:{ownerId:a.user.id},data:{subscriptionStatus:'SUSPENDED'}});assert.equal((await get(publicPath)).status,404);assert.equal((await get(preview,a.cookie)).status,200);
   const after=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.shop.id}});assert.deepEqual(after.data,commerceBefore.data);assert.equal(after.version,commerceBefore.version);const workspaceAfter=await prisma.workspace.findUniqueOrThrow({where:{ownerId:a.user.id}});assert.deepEqual(workspaceAfter.data,workspaceBefore.data);assert.equal(workspaceAfter.version,workspaceBefore.version);
  });
 }finally{stopTestServer(server);await prisma.organization.deleteMany({where:{ownerId:{in:ids}}});await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect();}
});
