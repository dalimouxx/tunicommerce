import {saveHomeDraft,HomeConflictError,type HomeFetcher} from '../modules/shops/home-editor-state';
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
  const legacy=await owner('legacy');const legacyState=initialState(false);legacyState.shop.name='Boutique existante '+mark;legacyState.products=initialState(true).products.slice(0,1);
  const legacyWorkspace=await prisma.workspace.update({where:{ownerId:legacy.user.id},data:{slug:'ancienne-'+mark,published:true,data:legacyState as never,version:7}});
  await prisma.shop.update({where:{id:legacy.shop.id},data:{legacyWorkspaceId:legacyWorkspace.id,status:'DRAFT'}});await prisma.shopCommerce.delete({where:{shopId:legacy.shop.id}});
  const legacyApi='/api/v1/shops/'+legacy.shop.id+'/home',legacyEditor='/mes-boutiques/'+legacy.shop.id+'/accueil',legacyPreview=legacyEditor+'/apercu',legacyPublic='/boutiques/'+legacyWorkspace.slug;
  let legacyRecord:HomeEditorRecord;const legacyDraft=initialHomeContent();legacyDraft.fr.heroTitle='ACCUEIL-EXISTANT-'+mark;legacyDraft.fr.announcement='ANNONCE-EXISTANTE-'+mark;legacyDraft.fr.sections=[{id:randomUUID(),type:'cta',title:'SECTION-EXISTANTE-'+mark,text:'Catalogue conservé',label:'Voir les produits'}];legacyDraft.ar.heroTitle='متجر موجود '+mark;
  async function legacyChange(action:'save'|'publish'|'unpublish'|'restore',content?:unknown){const response=await put(legacyApi,{action,version:legacyRecord.version,...(action==='save'?{content}:{})},legacy.cookie);if(response.ok)legacyRecord=await response.json();return response;}
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

  await t.test('existing workspace owners find Ma vitrine and the editor without migrating their commerce',async()=>{
   assert.equal((await get('/marchand',legacy.cookie)).status,200);for(const path of ['/personnalisation','/mes-boutiques/'+legacy.shop.id]){const r=await get(path,legacy.cookie);assert.equal(r.status,200,path);assert.ok((await r.text()).includes('Ma vitrine'),path);}
   const html=await (await get(legacyEditor,legacy.cookie)).text();assert.ok(html.includes('Compose l’accueil'));assert.ok(html.includes(legacyPublic));assert.equal(html.includes('/vitrines/'+legacy.shop.slug),false);
   assert.equal((await get(legacyApi)).status,401);assert.equal((await get(legacyApi,b.cookie)).status,404);legacyRecord=await (await get(legacyApi,legacy.cookie)).json();assert.equal(legacyRecord.version,0);assert.equal(await prisma.shopHome.count({where:{shopId:legacy.shop.id}}),0);
   assert.equal(await prisma.shopCommerce.count({where:{shopId:legacy.shop.id}}),0);
  });
  await t.test('legacy drafts preview privately and publish on the existing workspace URL in either language',async()=>{
   assert.equal((await legacyChange('save',legacyDraft)).status,200);assert.equal((await get(legacyPreview,b.cookie)).status,404);const previewHtml=await (await get(legacyPreview,legacy.cookie)).text();assert.ok(previewHtml.includes(legacyDraft.fr.heroTitle));assert.ok(previewHtml.includes('Commandes')||previewHtml.includes('commandes'));
   assert.equal((await (await get(legacyPublic)).text()).includes(legacyDraft.fr.heroTitle),false);assert.equal((await legacyChange('publish')).status,200);
   const html=await (await get(legacyPublic+'?lang=fr')).text();assert.ok(html.includes('<h1 dir="auto">'+legacyDraft.fr.heroTitle+'</h1>'));assert.ok(html.includes('SECTION-EXISTANTE-'+mark));assert.ok(html.includes(legacyDraft.fr.announcement));assert.ok(html.includes('id="catalogue"'));assert.ok(html.includes('Casque sans fil Studio'));
   const ar=await (await get(legacyPublic+'?lang=ar')).text();assert.ok(ar.includes('<h1 dir="auto">'+legacyDraft.ar.heroTitle+'</h1>'));assert.ok(ar.includes('dir="rtl"'));assert.equal(legacyRecord.hasUnpublishedChanges,false);
  });
  await t.test('global admin and foreign OWNER membership cannot bypass the workspace and organization owner',async()=>{
   await prisma.user.update({where:{id:b.user.id},data:{role:'ADMIN'}});await prisma.membership.create({data:{shopId:legacy.shop.id,userId:b.user.id,role:'OWNER'}});
   assert.equal((await get(legacyApi,b.cookie)).status,403);assert.equal((await put(legacyApi,{action:'unpublish',version:legacyRecord.version},b.cookie)).status,403);assert.equal((await get(legacyPreview,b.cookie)).status,404);
   await prisma.organization.update({where:{id:legacy.shop.organizationId},data:{ownerId:b.user.id}});assert.equal((await get(legacyApi,legacy.cookie)).status,403);assert.equal((await get(legacyApi,b.cookie)).status,403);assert.equal((await (await get(legacyPublic)).text()).includes(legacyDraft.fr.heroTitle),false);await prisma.organization.update({where:{id:legacy.shop.organizationId},data:{ownerId:legacy.user.id}});
   await prisma.membership.update({where:{shopId_userId:{shopId:legacy.shop.id,userId:legacy.user.id}},data:{active:false}});assert.equal((await get(legacyApi,legacy.cookie)).status,404);await prisma.membership.update({where:{shopId_userId:{shopId:legacy.shop.id,userId:legacy.user.id}},data:{active:true}});
  });
  await t.test('legacy publication uses the actual workspace gate and private preview survives unpublication',async()=>{
   await prisma.shop.update({where:{id:legacy.shop.id},data:{status:'PUBLISHED'}});await prisma.workspace.update({where:{id:legacyWorkspace.id},data:{published:false}});assert.equal((await legacyChange('publish')).status,409);assert.equal((await get(legacyPublic)).status,404);assert.equal((await get(legacyPreview,legacy.cookie)).status,200);
   await prisma.workspace.update({where:{id:legacyWorkspace.id},data:{published:true,subscriptionEndsAt:new Date(Date.now()-1000)}});assert.equal((await legacyChange('publish')).status,409);assert.equal((await get(legacyPublic)).status,404);
   await prisma.workspace.update({where:{id:legacyWorkspace.id},data:{subscriptionStatus:'SUSPENDED',subscriptionEndsAt:new Date(Date.now()+86400000)}});assert.equal((await legacyChange('publish')).status,409);await prisma.workspace.update({where:{id:legacyWorkspace.id},data:{subscriptionStatus:'ACTIVE'}});
  });
  await t.test('legacy saves, restores and theme fallback preserve the original workspace JSON and version',async()=>{
   const newer=structuredClone(legacyDraft);newer.fr.heroTitle='DRAFT-NOT-PUBLISHED-'+mark;assert.equal((await legacyChange('save',newer)).status,200);assert.equal((await (await get(legacyPublic)).text()).includes(newer.fr.heroTitle),false);assert.equal((await legacyChange('restore')).status,200);assert.equal(legacyRecord.draft.fr.heroTitle,legacyDraft.fr.heroTitle);
   assert.equal((await legacyChange('unpublish')).status,200);const html=await (await get(legacyPublic)).text();assert.ok(html.includes('Boutique existante '+mark));assert.equal(html.includes(legacyDraft.fr.heroTitle),false);assert.deepEqual(legacyRecord.draft,legacyDraft);
   const after=await prisma.workspace.findUniqueOrThrow({where:{id:legacyWorkspace.id}});assert.deepEqual(after.data,legacyWorkspace.data);assert.equal(after.version,legacyWorkspace.version);assert.equal(await prisma.shopCommerce.count({where:{shopId:legacy.shop.id}}),0);assert.equal((await legacyChange('publish')).status,200);
  });
  await t.test('legacy COD ordering remains on its existing API after homepage publication',async()=>{
   const r=await fetch(base+'/api/boutiques/'+legacyWorkspace.slug+'/checkout',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({requestId:randomUUID(),customer:{name:'Client de recette',phone:'22123456',city:'Tunis',address:'Adresse fictive'},items:[{productId:'p1',quantity:1}]})});assert.equal(r.status,201);const receipt=await r.json();assert.ok(receipt.reference);assert.match(receipt.trackingUrl,/^\/suivi\/[a-f0-9]{64}$/);assert.ok((await (await get(legacyPublic)).text()).includes(legacyDraft.fr.heroTitle));
  });

  const editorFetch:HomeFetcher=(url,init)=>fetch(base+url,{...init,headers:{...init.headers,cookie:a.cookie,origin}});
  await t.test('two editor tabs merge separate fields without losing changes or publishing drafts',async()=>{
   const baseRecord:HomeEditorRecord=await (await get(endpoint,a.cookie)).json();const mine=structuredClone(baseRecord.draft),theirs=structuredClone(baseRecord.draft);mine.fr.announcement='LOCAL-'+mark;theirs.ar.announcement='REMOTE-'+mark;
   const published=(await prisma.shopHome.findUniqueOrThrow({where:{shopId:a.shop.id}})).published;
   assert.equal((await put(endpoint,{action:'save',version:baseRecord.version,content:theirs},a.cookie)).status,200);
   const merged=await saveHomeDraft(endpoint,baseRecord,mine,new AbortController().signal,editorFetch);assert.equal(merged.draft.fr.announcement,mine.fr.announcement);assert.equal(merged.draft.ar.announcement,theirs.ar.announcement);assert.deepEqual((await prisma.shopHome.findUniqueOrThrow({where:{shopId:a.shop.id}})).published,published);
  });
  await t.test('a real same-field conflict preserves the remote draft and leaves the local text intact',async()=>{
   const baseRecord:HomeEditorRecord=await (await get(endpoint,a.cookie)).json();const mine=structuredClone(baseRecord.draft),theirs=structuredClone(baseRecord.draft);mine.fr.heroTitle='MON-TEXTE-'+mark;theirs.fr.heroTitle='AUTRE-ONGLET-'+mark;
   assert.equal((await put(endpoint,{action:'save',version:baseRecord.version,content:theirs},a.cookie)).status,200);
   await assert.rejects(saveHomeDraft(endpoint,baseRecord,mine,new AbortController().signal,editorFetch),error=>error instanceof HomeConflictError&&error.latest.draft.fr.heroTitle===theirs.fr.heroTitle&&error.conflicts.includes('fr.heroTitle'));
   assert.equal(mine.fr.heroTitle,'MON-TEXTE-'+mark);assert.equal((await (await get(endpoint,a.cookie)).json()).draft.fr.heroTitle,theirs.fr.heroTitle);
  });
  await t.test('a lost successful save response can be retried without another write or a reload error',async()=>{
   const baseRecord:HomeEditorRecord=await (await get(endpoint,a.cookie)).json();const mine=structuredClone(baseRecord.draft);mine.fr.heroDescription='REPONSE-PERDUE-'+mark;let lose=true;
   const unreliable:HomeFetcher=async(url,init)=>{const response=await editorFetch(url,init);if(lose&&init.method==='PUT'&&response.ok){lose=false;await response.arrayBuffer();throw new TypeError('Simulated connection lost after commit');}return response;};
   await assert.rejects(saveHomeDraft(endpoint,baseRecord,mine,new AbortController().signal,unreliable),/connection lost/);const savedVersion=(await (await get(endpoint,a.cookie)).json()).version;
   const retried=await saveHomeDraft(endpoint,baseRecord,mine,new AbortController().signal,editorFetch);assert.equal(retried.version,savedVersion);assert.equal(retried.draft.fr.heroDescription,mine.fr.heroDescription);
  });

  await prisma.workspace.update({where:{ownerId:a.user.id},data:{subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)}});
  const photoBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');const photoData={content:photoBytes,mimeType:'image/png',size:photoBytes.length,width:1,height:1};
  const aw=await prisma.workspace.findUniqueOrThrow({where:{ownerId:a.user.id}}),bw=await prisma.workspace.findUniqueOrThrow({where:{ownerId:b.user.id}});
  const ownPhoto=await prisma.productMedia.create({data:{workspaceId:aw.id,...photoData}}),unusedPhoto=await prisma.productMedia.create({data:{workspaceId:aw.id,...photoData}}),foreignPhoto=await prisma.productMedia.create({data:{workspaceId:bw.id,...photoData}});
  const photoUrl=(id:string)=>'/api/media/products/'+id,publicPhoto=(slug:string,id:string)=>'/api/v1/public/vitrines/'+slug+'/images/'+id;
  const imageSection=(url:string)=>({id:randomUUID(),type:'image' as const,title:'Image de collection',imageUrl:url,alt:'VISUEL-ACCESSIBLE-'+mark,caption:'LEGENDE-PUBLIQUE-'+mark,layout:'wide' as const,fit:'contain' as const});
  const removePhoto=(id:string,cookie=a.cookie)=>fetch(base+'/api/v1/product-media/'+id,{method:'DELETE',headers:{origin,cookie}});
  record=await (await get(endpoint,a.cookie)).json();const imageDraft=structuredClone(record.draft);imageDraft.fr.sections=[imageSection(photoUrl(ownPhoto.id))];
  const beforeImages=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.shop.id}});
  await t.test('image drafts are owner-scoped and do not expose an unreferenced image',async()=>{
   assert.equal((await change('unpublish')).status,200);assert.equal((await change('save',imageDraft)).status,200);assert.equal((await get(publicPhoto(a.shop.slug,ownPhoto.id))).status,404);
   const invalid=structuredClone(imageDraft);invalid.fr.sections=[imageSection(photoUrl(foreignPhoto.id))];assert.equal((await change('save',invalid)).status,403);assert.equal((await get(preview,a.cookie)).status,200);
   assert.equal((await removePhoto(ownPhoto.id)).status,409);
  });
  await t.test('published image sections serve real bytes without requiring the legacy workspace to be published',async()=>{
   assert.equal(aw.published,false);assert.equal((await change('publish')).status,200);const r=await get(publicPhoto(a.shop.slug,ownPhoto.id));assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await r.arrayBuffer()),photoBytes);
   const html=await (await get(publicPath+'?lang=fr')).text();assert.ok(html.includes(publicPhoto(a.shop.slug,ownPhoto.id)));assert.ok(html.includes('VISUEL-ACCESSIBLE-'+mark));assert.ok(html.includes('LEGENDE-PUBLIQUE-'+mark));assert.ok(html.includes('loading="lazy"'));
   const after=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.shop.id}});assert.deepEqual(after.data,beforeImages.data);assert.equal(after.version,beforeImages.version);
  });
  await t.test('image routes refuse foreign and unused photos even with a valid owner cookie',async()=>{
   for(const [slug,id] of [[b.shop.slug,ownPhoto.id],[a.shop.slug,unusedPhoto.id],[a.shop.slug,foreignPhoto.id]])assert.equal((await get(publicPhoto(slug,id),a.cookie)).status,404);
   await prisma.workspace.update({where:{ownerId:a.user.id},data:{subscriptionStatus:'SUSPENDED'}});assert.equal((await get(publicPhoto(a.shop.slug,ownPhoto.id),a.cookie)).status,404);await prisma.workspace.update({where:{ownerId:a.user.id},data:{subscriptionStatus:'ACTIVE'}});
  });
  await t.test('history pins a formerly published photo until all retained references expire',async()=>{
   const next=structuredClone(imageDraft);next.fr.sections=[imageSection('https://cdn.example.com/another.jpg')];assert.equal((await change('save',next)).status,200);assert.equal((await removePhoto(ownPhoto.id)).status,409);assert.equal((await get(publicPhoto(a.shop.slug,ownPhoto.id))).status,200);
   assert.equal((await change('unpublish')).status,200);assert.equal((await get(publicPhoto(a.shop.slug,ownPhoto.id))).status,404);assert.equal((await removePhoto(ownPhoto.id)).status,409);
   for(let n=0;n<20;n++){next.fr.announcement='Étape sans cette photo '+n;assert.equal((await change('save',next)).status,200);}
   assert.equal((await removePhoto(ownPhoto.id)).status,200);
  });
  await t.test('a photo deletion racing a home save never leaves a saved dangling reference',async()=>{
   const next=structuredClone(record.draft);next.fr.sections=[imageSection(photoUrl(unusedPhoto.id))];const results=await Promise.all([put(endpoint,{action:'save',version:record.version,content:next},a.cookie),removePhoto(unusedPhoto.id)]);const statuses=results.map(r=>r.status);assert.ok(statuses[0]===200&&statuses[1]===409||statuses[0]===403&&statuses[1]===200,JSON.stringify(statuses));
  });
  await t.test('the existing legacy storefront uses its linked shop image scope and its workspace publication gate',async()=>{
   const photo=await prisma.productMedia.create({data:{workspaceId:legacyWorkspace.id,...photoData}});const home=structuredClone(legacyRecord.draft);home.fr.sections=[imageSection(photoUrl(photo.id))];assert.equal((await legacyChange('save',home)).status,200);assert.equal((await legacyChange('publish')).status,200);
   const html=await (await get(legacyPublic)).text();assert.ok(html.includes(publicPhoto(legacy.shop.slug,photo.id)));assert.equal((await get(publicPhoto(legacy.shop.slug,photo.id))).status,200);
   await prisma.workspace.update({where:{id:legacyWorkspace.id},data:{published:false}});assert.equal((await get(publicPhoto(legacy.shop.slug,photo.id),legacy.cookie)).status,404);const draftHtml=await (await get(legacyPreview,legacy.cookie)).text();assert.ok(draftHtml.includes(photoUrl(photo.id)));assert.equal((await get(photoUrl(photo.id),legacy.cookie)).status,200);
  });
  const historyApi=endpoint+'/history';
  record=await (await get(endpoint,a.cookie)).json();
  type Summary={id:string;version:number;action:string;title:string};
  let savedRevision:string;
  await t.test('history is private, owner-only, bounded and does not leak full content in summaries',async()=>{
   assert.equal((await get(historyApi)).status,401);assert.equal((await get(historyApi,b.cookie)).status,404);
   await prisma.membership.create({data:{shopId:a.shop.id,userId:b.user.id,role:'VIEWER'}});assert.equal((await get(historyApi,b.cookie)).status,403);
   const response=await get(historyApi,a.cookie);assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/no-store/);
   const {revisions}=await response.json();assert.equal(revisions.length,20);assert.equal('content' in revisions[0],false);assert.ok(revisions[0].version>revisions[19].version);
   assert.equal((await get(historyApi+'/invalid',a.cookie)).status,404);
   const empty=await (await get('/api/v1/shops/'+b.shop.id+'/home/history',b.cookie)).json();assert.deepEqual(empty,{revisions:[]});assert.equal(await prisma.shopHome.count({where:{shopId:b.shop.id}}),0);
  });
  await t.test('selected revisions retain both languages and restore only the draft, without changing publication or commerce',async()=>{
   const first=structuredClone(record.draft);first.fr.heroTitle='HISTOIRE-UNE-'+mark;first.ar.heroTitle='نسخة سابقة '+mark;
   assert.equal((await change('save',first)).status,200);const list=await (await get(historyApi,a.cookie)).json();savedRevision=list.revisions[0].id;
   const detail=await get(historyApi+'/'+savedRevision,a.cookie);assert.equal(detail.status,200);const revision=await detail.json();assert.deepEqual(revision.content,first);
   assert.equal((await get(historyApi+'/'+savedRevision,b.cookie)).status,403);assert.equal((await get('/api/v1/shops/'+b.shop.id+'/home/history/'+savedRevision,b.cookie)).status,404);
   const next=structuredClone(first);next.fr.heroTitle='HISTOIRE-DEUX-'+mark;assert.equal((await change('save',next)).status,200);assert.equal((await change('publish')).status,200);
   const before=await prisma.shopHome.findUniqueOrThrow({where:{shopId:a.shop.id}}),commerce=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.shop.id}});
   const response=await put(endpoint,{action:'restoreRevision',version:record.version,revisionId:savedRevision},a.cookie);assert.equal(response.status,200);record=await response.json();assert.deepEqual(record.draft,first);assert.equal(record.hasUnpublishedChanges,true);
   const after=await prisma.shopHome.findUniqueOrThrow({where:{shopId:a.shop.id}});assert.deepEqual(after.published,before.published);assert.equal(after.publishedAt?.toISOString(),before.publishedAt?.toISOString());assert.equal(after.publishedVersion,before.publishedVersion);assert.deepEqual(await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.shop.id}}),commerce);
   const live=await (await get(publicPath)).text();assert.ok(live.includes(next.fr.heroTitle));assert.equal(live.includes(first.fr.heroTitle),false);
  });
  await t.test('rejected restores never add history entries, and foreign revision ids cannot be used',async()=>{
   const before=await prisma.shopHome.findUniqueOrThrow({where:{shopId:a.shop.id}}),body={action:'restoreRevision',version:record.version,revisionId:savedRevision};
   assert.equal((await put(endpoint,body,a.cookie,'https://evil.test')).status,403);assert.equal((await put(endpoint,body,b.cookie)).status,403);
   assert.equal((await put(endpoint,{...body,version:0},a.cookie)).status,409);assert.equal((await put(endpoint,{...body,revisionId:randomUUID()},a.cookie)).status,404);
   const foreignList=await (await get(legacyApi+'/history',legacy.cookie)).json();assert.ok(foreignList.revisions.length);assert.equal((await put(endpoint,{...body,revisionId:foreignList.revisions[0].id},a.cookie)).status,404);
   assert.deepEqual(await prisma.shopHome.findUniqueOrThrow({where:{shopId:a.shop.id}}),before);
  });
  await t.test('two restorations of the same expected version serialize with a single history entry',async()=>{
   const before=record.version,body={action:'restoreRevision',version:before,revisionId:savedRevision};const results=await Promise.all([put(endpoint,body,a.cookie),put(endpoint,body,a.cookie)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);record=await results.find(r=>r.ok)!.json();assert.equal(record.version,before+1);
   const {revisions}=await (await get(historyApi,a.cookie)).json();assert.equal(revisions.filter((r:Summary)=>r.version===record.version).length,1);assert.equal(revisions[0].action,'restoreRevision');
  });
  await t.test('pre-upgrade legacy drafts and distinct publication are checkpointed only on the next mutation',async()=>{
   const previous=await prisma.shopHome.findUniqueOrThrow({where:{shopId:legacy.shop.id}}),older=structuredClone(legacyRecord.draft);older.fr.heroTitle='PUBLICATION-AVANT-HISTORIQUE-'+mark;
   await prisma.shopHome.update({where:{shopId:legacy.shop.id},data:{history:[],published:older as never,publishedAt:new Date(),publishedVersion:1}});
   const list=await (await get(legacyApi+'/history',legacy.cookie)).json();assert.deepEqual(list,{revisions:[]});assert.deepEqual((await prisma.shopHome.findUniqueOrThrow({where:{shopId:legacy.shop.id}})).history,[]);
   const next=structuredClone(legacyRecord.draft);next.fr.heroTitle='NOUVEAU-LEGACY-'+mark;assert.equal((await legacyChange('save',next)).status,200);
   const {revisions}=await (await get(legacyApi+'/history',legacy.cookie)).json();assert.equal(revisions.length,3);assert.deepEqual(revisions.map((r:Summary)=>r.action),['save','checkpoint','publishedCheckpoint']);
   const oldDraft=await (await get(legacyApi+'/history/'+revisions[1].id,legacy.cookie)).json(),oldPublished=await (await get(legacyApi+'/history/'+revisions[2].id,legacy.cookie)).json();assert.deepEqual(oldDraft.content,previous.draft);assert.deepEqual(oldPublished.content,older);
   const response=await put(legacyApi,{action:'restoreRevision',version:legacyRecord.version,revisionId:revisions[1].id},legacy.cookie);assert.equal(response.status,200);legacyRecord=await response.json();assert.deepEqual(legacyRecord.draft,previous.draft);assert.equal(await prisma.shopCommerce.count({where:{shopId:legacy.shop.id}}),0);
  });
 }finally{stopTestServer(server);await prisma.organization.deleteMany({where:{ownerId:{in:ids}}});await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect();}
});

