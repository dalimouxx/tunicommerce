import {initialHomeContent} from '../modules/shops/home-content';
import {request as httpRequest} from 'node:http';
import test from 'node:test';import assert from 'node:assert/strict';import {spawn,type ChildProcess} from 'node:child_process';import {randomBytes,randomUUID} from 'node:crypto';import {setTimeout as delay} from 'node:timers/promises';import {createSocket} from 'node:dgram';import {stopTestServer} from './server-process';
const db=process.env.TEST_DATABASE_URL;if(!db||db!==process.env.DATABASE_URL||!new URL(db).pathname.endsWith('_test'))throw Error('Disposable *_test DB required');
const host='http://127.0.0.1:3203',platform='platform.tunicom-audit.tn',origin='https://'+platform;process.env.APP_URL=origin;process.env.STOREFRONT_ROOT_DOMAIN='shops.tunicom-audit.tn';process.env.STOREFRONT_DOMAIN_ROUTING='enabled';
const {prisma}=await import('../modules/storage/client');const {initialState}=await import('../modules/commerce/seed');const {portalSessionHash}=await import('../modules/auth/portal');const {changeShopDomain}=await import('../modules/shops/domains-service');
function hostFetch(url:string,init:RequestInit):Promise<Response>{return new Promise((resolve,reject)=>{const req=httpRequest(url,{method:init.method||'GET',headers:init.headers as Record<string,string>},res=>{const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(Buffer.from(chunk)));res.on('end',()=>{const headers=new Headers();for(const [key,value] of Object.entries(res.headers)){if(Array.isArray(value))for(const item of value)headers.append(key,item);else if(value!==undefined)headers.set(key,value);}resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers}));});});req.on('error',reject);req.setTimeout(10000,()=>req.destroy(Error('HTTP fixture timed out')));req.end(init.body as string|undefined);});}
const get=(path:string,cookie='',domain=platform,extra:Record<string,string>={})=>hostFetch(host+path,{redirect:'manual',headers:{host:domain,cookie,...extra}});
const post=(path:string,body:unknown,cookie='',domain=platform,from=origin)=>hostFetch(host+path,{method:'POST',redirect:'manual',headers:{host:domain,origin:from,cookie,'content-type':'application/json'},body:JSON.stringify(body)});
test('Domain ownership, per-shop routing, checkout and revocation work through the production proxy',async t=>{
 let child:ChildProcess|undefined;const ids:string[]=[];const mark=randomBytes(4).toString('hex');const txt=new Map<string,string>();const questions:string[]=[];const dns=createSocket('udp4');
 dns.on('message',(query,remote)=>{let cursor=12;const labels:string[]=[];while(query[cursor]&&cursor<query.length){const length=query[cursor++];labels.push(query.subarray(cursor,cursor+length).toString());cursor+=length;}cursor+=5;const name=labels.join('.');questions.push(name);const value=txt.get(name);const header=Buffer.alloc(12);query.copy(header,0,0,2);header.writeUInt16BE(value?0x8180:0x8183,2);header.writeUInt16BE(1,4);header.writeUInt16BE(value?1:0,6);const parts=[header,query.subarray(12,cursor)];if(value){const bytes=Buffer.from(value),answer=Buffer.alloc(13);answer.writeUInt16BE(0xc00c,0);answer.writeUInt16BE(16,2);answer.writeUInt16BE(1,4);answer.writeUInt32BE(5,6);answer.writeUInt16BE(bytes.length+1,10);answer[12]=bytes.length;parts.push(answer,bytes);}dns.send(Buffer.concat(parts),remote.port,remote.address);});
 await new Promise<void>(resolve=>dns.bind(0,'127.0.0.1',resolve));const address=dns.address();if(typeof address==='string')throw Error('Expected UDP address');
 try{
  async function owner(label:string){const token=randomBytes(32).toString('hex');const state=initialState(false);state.shop.name='Domaine '+label;state.products=initialState(true).products.slice(0,1);const user=await prisma.user.create({data:{email:'domain-'+label+'-'+mark+'@example.test',name:'Compte domaine '+label,passwordHash:'unused-fixture',workspace:{create:{plan:'PRO',subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000),data:initialState(false) as never}}}});ids.push(user.id);await prisma.session.create({data:{userId:user.id,tokenHash:portalSessionHash(token,'MERCHANT'),authVersion:user.authVersion,expiresAt:new Date(Date.now()+86400000)}});const org=await prisma.organization.create({data:{ownerId:user.id,name:'Domaines '+label}});const shop=await prisma.shop.create({data:{organizationId:org.id,name:state.shop.name,slug:'domain-'+label+'-'+mark,status:'PUBLISHED',memberships:{create:{userId:user.id,role:'OWNER'}},commerce:{create:{data:state as never}}}});return {user,shop,cookie:'__Host-tunicommerce='+token};}
  const a=await owner('a'),b=await owner('b');const api='/api/v1/shops/'+a.shop.id+'/domains',custom='boutique-'+mark+'.marque.tn';
  child=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3203',DATABASE_URL:db,APP_URL:origin,STOREFRONT_DOMAIN_ROUTING:'enabled',STOREFRONT_ROOT_DOMAIN:'shops.tunicom-audit.tn',DOMAIN_DNS_SERVERS:'127.0.0.1:'+address.port},stdio:'ignore'});
  let ready=false;for(let n=0;n<160;n++){try{if((await get('/api/health')).ok){ready=true;break;}}catch{}if(child.exitCode!==null)throw Error('Domain server exited');await delay(250);}assert.ok(ready);
  let claimId='',recordName='',recordValue='';
  await t.test('private settings reject anonymous, foreign owners and forged origins before DNS',async()=>{
   assert.equal((await get(api)).status,401);assert.equal((await get(api,b.cookie)).status,404);assert.equal((await post(api,{action:'add',hostname:custom},a.cookie,platform,'https://evil.tn')).status,403);assert.equal((await get('/mes-boutiques/'+a.shop.id+'/domaines',a.cookie)).status,200);assert.equal((await get('/mes-boutiques/'+a.shop.id+'/domaines',b.cookie)).status,404);
  });
  await t.test('pending claims do not reserve a domain globally and never enable routing',async()=>{
   assert.equal((await post(api,{action:'add',hostname:custom},a.cookie)).status,200);const view=await (await get(api,a.cookie)).json();const claim=view.claims[0];claimId=claim.id;recordName=claim.recordName;recordValue=claim.recordValue;assert.equal(claim.verifiedAt,null);assert.equal((await get('/','',custom)).status,404);
   assert.equal((await post('/api/v1/shops/'+b.shop.id+'/domains',{action:'add',hostname:custom},b.cookie)).status,200);
   assert.equal((await post(api,{action:'verify',id:claimId},a.cookie)).status,409);assert.equal(await prisma.shopDomainBinding.count({where:{hostname:custom}}),0);
  });
  await t.test('real TXT lookup against a local DNS fixture binds exactly one shop',async()=>{
   txt.set(recordName,recordValue);assert.equal((await post(api,{action:'verify',id:claimId},a.cookie)).status,200);
   const home=initialHomeContent();home.fr.heroTitle='ACCUEIL-PUBLIE-'+mark;const hidden=structuredClone(home);hidden.fr.heroTitle='ACCUEIL-BROUILLON-SECRET-'+mark;
   await prisma.shopHome.create({data:{shopId:a.shop.id,draft:hidden as never,published:home as never,publishedAt:new Date(),publishedVersion:1,version:2}});
   const own=await get('/','',custom);assert.equal(own.status,200);const html=await own.text();assert.ok(html.includes('Domaine a'));assert.equal(html.includes('Domaine b'),false);assert.ok(html.includes('ACCUEIL-PUBLIE-'+mark));assert.equal(html.includes('ACCUEIL-BROUILLON-SECRET-'+mark),false);
   const bv=await (await get('/api/v1/shops/'+b.shop.id+'/domains',b.cookie)).json();txt.set(bv.claims[0].recordName,bv.claims[0].recordValue);assert.equal((await post('/api/v1/shops/'+b.shop.id+'/domains',{action:'verify',id:bv.claims[0].id},b.cookie)).status,409);assert.equal((await prisma.shopDomainBinding.findUniqueOrThrow({where:{hostname:custom}})).shopId,a.shop.id);txt.set(recordName,recordValue);
  });
  await t.test('private and other-tenant paths stay closed even with a valid platform cookie',async()=>{
   for(const path of ['/admin','/mes-boutiques','/api/commerce','/api/admin/plans','/vitrines/'+b.shop.slug,'/_next/image?url=/admin&w=640&q=75'])assert.equal((await get(path,a.cookie,custom)).status,404,path);
   const normal=await get('/vitrines/'+a.shop.slug,'',custom);assert.equal(normal.status,308);assert.equal(normal.headers.get('location'),'https://'+custom+'/');
   const spoof=await get('/','',custom,{'x-forwarded-host':'evil.marque.tn','x-tunicom-domain-slug':b.shop.slug});assert.equal(spoof.status,200);const html=await spoof.text();assert.ok(html.includes('Domaine a'));assert.equal(html.includes('Domaine b'),false);assert.ok(html.includes('ACCUEIL-PUBLIE-'+mark));assert.equal(html.includes('ACCUEIL-BROUILLON-SECRET-'+mark),false);
  });
  await t.test('uploaded photos and branding are public only when referenced by this shop and owned by its merchant',async()=>{
   const aw=await prisma.workspace.findUniqueOrThrow({where:{ownerId:a.user.id}}),bw=await prisma.workspace.findUniqueOrThrow({where:{ownerId:b.user.id}});
   const image={content:Buffer.from('fixture-image'),mimeType:'image/png',size:13,width:1,height:1};
   const own=await prisma.productMedia.create({data:{workspaceId:aw.id,...image}}),unused=await prisma.productMedia.create({data:{workspaceId:aw.id,...image}}),foreign=await prisma.productMedia.create({data:{workspaceId:bw.id,...image}}),logo=await prisma.shopMedia.create({data:{workspaceId:aw.id,slot:'logo',...image}});
   const row=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.shop.id}});const state=row.data as unknown as ReturnType<typeof initialState>;state.products[0].imageUrl='/api/media/products/'+own.id;state.shop.logoUrl='/api/media/assets/'+logo.id;
   await prisma.shopCommerce.update({where:{shopId:a.shop.id},data:{data:state as never}});
   const sectionPhoto=await prisma.productMedia.create({data:{workspaceId:aw.id,...image}});const publishedHome=(await prisma.shopHome.findUniqueOrThrow({where:{shopId:a.shop.id}})).published as unknown as ReturnType<typeof initialHomeContent>;publishedHome.fr.sections=[{id:randomUUID(),type:'image',title:'Visuel de domaine',imageUrl:'/api/media/products/'+sectionPhoto.id,alt:'Photo de la section',caption:'Image publiée',layout:'square',fit:'contain'}];await prisma.shopHome.update({where:{shopId:a.shop.id},data:{published:publishedHome as never}});
   const imagePath='/api/v1/public/vitrines/'+a.shop.slug+'/images/'+sectionPhoto.id;assert.equal((await get(imagePath,'',custom)).status,200);assert.equal((await get('/api/media/products/'+sectionPhoto.id,a.cookie,custom)).status,404);assert.equal((await get(imagePath.replace(a.shop.slug,b.shop.slug),a.cookie,custom)).status,404);assert.ok((await (await get('/','',custom)).text()).includes(imagePath));
   assert.equal((await get('/api/media/products/'+own.id,'',custom)).status,200);assert.equal((await get('/api/media/assets/'+logo.id,'',custom)).status,200);
   assert.equal((await get('/api/media/products/'+unused.id,a.cookie,custom)).status,404);assert.equal((await get('/api/media/products/'+own.id,a.cookie,b.shop.slug+'.shops.tunicom-audit.tn')).status,404);
   state.products[0].imageUrl='/api/media/products/'+foreign.id;await prisma.shopCommerce.update({where:{shopId:a.shop.id},data:{data:state as never}});assert.equal((await get('/api/media/products/'+foreign.id,b.cookie,custom)).status,404);
   state.products[0].imageUrl='/api/media/products/'+own.id;await prisma.shopCommerce.update({where:{shopId:a.shop.id},data:{data:state as never}});
  });
  await t.test('same-origin custom checkout works, cross-origin and other shop checkout fail',async()=>{
   const body={requestId:randomUUID(),name:'Acheteur fictif',phone:'22123456',city:'Tunis',address:'Adresse de recette',items:[{productId:'p1',quantity:1}]};const endpoint='/api/v1/public/vitrines/'+a.shop.slug+'/checkout';
   assert.equal((await post(endpoint,body,'',custom,'https://evil.marque.tn')).status,403);assert.equal((await post('/api/v1/public/vitrines/'+b.shop.slug+'/checkout',body,'',custom,'https://'+custom)).status,404);
   const paid=await post(endpoint,body,'',custom,'https://'+custom);assert.equal(paid.status,201);const receipt=await paid.json();assert.equal(receipt.trackingToken,body.requestId);assert.equal((await get('/suivi/'+receipt.trackingToken,'',custom)).status,200);const requestPath='/api/v1/public/vitrines/'+a.shop.slug+'/suivi/'+receipt.trackingToken+'/requests';assert.equal((await post(requestPath,{id:randomUUID(),type:'CANCEL',reason:'Annulation de recette'},'',custom,'https://'+custom)).status,201);
  });
  await t.test('automatic subdomains, TLS permissions and publication gates use the same shop rules',async()=>{
   const automatic=a.shop.slug+'.shops.tunicom-audit.tn';assert.equal((await get('/','',automatic)).status,200);assert.equal((await get('/api/v1/public/domains/allow?domain='+automatic,'','127.0.0.1:3203')).status,200);assert.equal((await get('/api/v1/public/domains/allow?domain=unknown.marque.tn','','127.0.0.1:3203')).status,403);
   await prisma.workspace.update({where:{ownerId:a.user.id},data:{subscriptionStatus:'SUSPENDED'}});assert.equal((await get('/','',custom)).status,404);assert.equal((await get('/','',automatic)).status,404);assert.equal((await get('/api/v1/public/domains/allow?domain='+custom,'','127.0.0.1:3203')).status,403);await prisma.workspace.update({where:{ownerId:a.user.id},data:{subscriptionStatus:'ACTIVE'}});
  });
  await t.test('revocation during DNS verification cannot persist a stale binding',async()=>{
   const extra='race-'+mark+'.marque.tn';await changeShopDomain(a.user.id,a.shop.id,{action:'add',hostname:extra});const claim=await prisma.shopDomainClaim.findUniqueOrThrow({where:{shopId_hostname:{shopId:a.shop.id,hostname:extra}}});
   await assert.rejects(changeShopDomain(a.user.id,a.shop.id,{action:'verify',id:claim.id},async()=>{await prisma.membership.update({where:{shopId_userId:{shopId:a.shop.id,userId:a.user.id}},data:{active:false}});return [['tunicom='+claim.token]];}),/introuvable/);assert.equal(await prisma.shopDomainBinding.count({where:{hostname:extra}}),0);await prisma.membership.update({where:{shopId_userId:{shopId:a.shop.id,userId:a.user.id}},data:{active:true}});
  });
  await t.test('removing an owned claim disables its host immediately and preserves commerce',async()=>{
   const before=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.shop.id}});assert.equal((await post(api,{action:'remove',id:claimId},b.cookie)).status,404);assert.equal((await post(api,{action:'remove',id:claimId},a.cookie)).status,200);assert.equal((await get('/','',custom)).status,404);assert.deepEqual((await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.shop.id}})).data,before.data);
  });
 }finally{stopTestServer(child);dns.close();await prisma.organization.deleteMany({where:{ownerId:{in:ids}}});await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect();}
});





