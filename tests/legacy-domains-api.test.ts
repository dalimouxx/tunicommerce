import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {request} from 'node:http';
import {setTimeout as pause} from 'node:timers/promises';
import {initialState} from '../modules/commerce/seed';
import {initialHomeContent} from '../modules/shops/home-content';
import {initialPageContent} from '../modules/shops/page-content';
import {portalSessionHash} from '../modules/auth/portal';
import {stopTestServer} from './server-process';
const database=process.env.TEST_DATABASE_URL;
if(!database||database!==process.env.DATABASE_URL||!new URL(database).pathname.endsWith('_test'))throw Error('Legacy domains need matching disposable *_test databases');
const mark=randomBytes(4).toString('hex'),platform='platform.example.test',base='http://127.0.0.1:3215',root='shops.example';
process.env.APP_URL='https://'+platform;process.env.STOREFRONT_DOMAIN_ROUTING='enabled';process.env.STOREFRONT_ROOT_DOMAIN=root;
const {prisma}=await import('../modules/storage/client');
const {changeShopDomain}=await import('../modules/shops/domains-service');
const {resolveStorefrontHost,assertPublicStorefrontOrigin}=await import('../modules/shops/domains-routing');
const {rebuildActivity,verifyActivity}=await import('../modules/shops/activity-index-service');
const users:string[]=[],orgs:string[]=[];let child:ChildProcess|undefined;
function call(path:string,host=platform,body?:unknown,origin='https://'+host,cookie='',extra:Record<string,string>={}){return new Promise<Response>((resolve,reject)=>{const req=request(base+path,{method:body?'POST':'GET',headers:{...extra,host,cookie,...(body?{origin,'content-type':'application/json'}:{})}},res=>{const chunks:Buffer[]=[];res.on('data',c=>chunks.push(Buffer.from(c)));res.on('end',()=>{const headers=new Headers();for(const [k,v]of Object.entries(res.headers))if(Array.isArray(v))for(const item of v)headers.append(k,item);else if(v!==undefined)headers.set(k,v);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers}));});});req.on('error',reject);req.setTimeout(15000,()=>req.destroy(Error('Fixture timeout')));req.end(body?JSON.stringify(body):undefined);});}
async function account(suffix:string){
 const state=initialState(false);state.shop.name='Boutique historique fictive '+suffix;state.products=[{...initialState(true).products[0],imageUrl:'',stock:100}];
 const user=await prisma.user.create({data:{email:'legacy-domain-'+mark+suffix+'@example.test',name:'Compte fictif',passwordHash:'unused-fixture',workspace:{create:{data:state as never,slug:'legacy-workspace-'+mark+suffix,published:true,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)}}},include:{workspace:true}});users.push(user.id);
 const org=await prisma.organization.create({data:{ownerId:user.id,name:'Groupe fictif'}});orgs.push(org.id);
 const shop=await prisma.shop.create({data:{organizationId:org.id,name:state.shop.name,slug:'legacy-domain-'+mark+suffix,legacyWorkspaceId:user.workspace!.id,memberships:{create:{userId:user.id,role:'OWNER'}}}});
 const token=randomBytes(32).toString('hex');await prisma.session.create({data:{userId:user.id,tokenHash:portalSessionHash(token,'MERCHANT'),expiresAt:new Date(Date.now()+3600000)}});
 const host='legacy-'+mark+suffix+'.example';await changeShopDomain(user.id,shop.id,{action:'add',hostname:host});const claim=await prisma.shopDomainClaim.findUniqueOrThrow({where:{shopId_hostname:{shopId:shop.id,hostname:host}}});await changeShopDomain(user.id,shop.id,{action:'verify',id:claim.id},async()=>[['tunicom='+claim.token]]);
 return {user,org,shop,host,claim,cookie:'__Host-tunicommerce='+token};
}
test('Legacy storefront domains preserve checkout, tracking and media isolation without moving merchant data',async t=>{
 try{
  const a=await account('a'),b=await account('b');
  child=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3215'},stdio:'ignore'});
  let ready=false;for(let i=0;i<120;i++){try{if((await call('/api/health')).ok){ready=true;break;}}catch{}if(child.exitCode!==null)throw Error('Legacy domain server exited');await pause(250);}assert.ok(ready);
  await t.test('Shop and historical workspace may have different slugs, with the same verified and automatic storefront',async()=>{
   const target=await resolveStorefrontHost(a.host);assert.equal(target?.slug,a.shop.slug);assert.equal(target?.legacySlug,a.user.workspace!.slug);
   for(const host of [a.host,a.shop.slug+'.'+root]){const response=await call('/',host);assert.equal(response.status,200);assert.ok((await response.text()).includes('Casque sans fil Studio'));assert.equal((await call('/api/v1/public/domains/allow?domain='+host)).status,200);}
   const historical=await call('/boutiques/'+a.user.workspace!.slug+'?lang=ar',a.host);assert.equal(historical.status,308);assert.equal(historical.headers.get('location'),'https://'+a.host+'/?lang=ar');
   const directory=await call('/boutiques',a.host);assert.equal(directory.headers.get('location'),'https://'+platform+'/boutiques');
   const privatePage=await call('/mes-boutiques/'+a.shop.id,platform,undefined,undefined,a.cookie);assert.ok((await privatePage.text()).includes('/mes-boutiques/'+a.shop.id+'/domaines'));
  });
  await t.test('A real platform session cannot open private or other-store paths on a historical host',async()=>{
   for(const path of ['/admin','/mes-boutiques','/api/commerce','/api/admin/plans','/connexion/boutique','/vitrines/'+b.shop.slug,'/boutiques/'+b.user.workspace!.slug,'/api/v1/shops/'+a.shop.id+'/activity','/_next/image'])assert.equal((await call(path,a.host,undefined,undefined,a.cookie)).status,404,path);
   await assert.rejects(assertPublicStorefrontOrigin(new Request('https://'+a.host,{headers:{host:a.host,origin:'https://'+a.host}}),a.shop.slug),/Origine interdite/);
   assert.equal((await call('/','unknown-'+mark+'.example',undefined,undefined,a.cookie,{'x-forwarded-host':a.host,'x-tunicom-domain-slug':a.shop.slug})).status,404);
   const forwarded=await call('/',a.host,undefined,undefined,a.cookie,{'x-forwarded-host':b.host});assert.equal(forwarded.status,200);assert.ok((await forwarded.text()).includes('Boutique historique fictive a'));
  });
  await t.test('Published pages and section photos remain scoped to the bound shop and publication state',async()=>{
   const image={content:Buffer.from('local-image-fixture'),mimeType:'image/png',size:19,width:1,height:1};
   const photo=await prisma.productMedia.create({data:{workspaceId:a.user.workspace!.id,...image}}),unused=await prisma.productMedia.create({data:{workspaceId:a.user.workspace!.id,...image}}),foreign=await prisma.productMedia.create({data:{workspaceId:b.user.workspace!.id,...image}});
   const logo=await prisma.shopMedia.create({data:{workspaceId:a.user.workspace!.id,slot:'logo',...image}});
   const current=await prisma.workspace.findUniqueOrThrow({where:{id:a.user.workspace!.id}}),state=current.data as unknown as ReturnType<typeof initialState>;state.products[0].imageUrl='/api/media/products/'+photo.id;state.shop.logoUrl='/api/media/assets/'+logo.id;
   await prisma.workspace.update({where:{id:current.id},data:{data:state as never}});
   assert.equal((await call('/api/media/products/'+photo.id,a.host)).status,200);assert.equal((await call('/api/media/assets/'+logo.id,a.host)).status,200);
   assert.equal((await call('/api/media/products/'+photo.id)).status,200);assert.equal((await call('/api/media/assets/'+logo.id)).status,200);
   assert.equal((await call('/api/media/products/'+unused.id)).status,404,'Publishing a store must not publish its unused library');
   const privatePreview=await call('/api/media/products/'+unused.id,platform,undefined,undefined,a.cookie);assert.equal(privatePreview.status,200);assert.equal(privatePreview.headers.get('cache-control'),'private, no-store');
   state.products[0].active=false;state.shop.logoUrl='';await prisma.workspace.update({where:{id:current.id},data:{data:state as never}});
   assert.equal((await call('/api/media/products/'+photo.id)).status,404);assert.equal((await call('/api/media/products/'+photo.id,a.host)).status,404);assert.equal((await call('/api/media/assets/'+logo.id)).status,404);
   const isolated=initialState(false);isolated.products=[{...initialState(true).products[0],imageUrl:'/api/media/products/'+photo.id}];
   const independent=await prisma.shop.create({data:{organizationId:b.org.id,name:'Independent media fixture',slug:'isolated-media-'+mark,status:'PUBLISHED',commerce:{create:{data:isolated as never}}}});
   assert.equal((await call('/api/media/products/'+photo.id)).status,404,'A foreign store cannot publish another owner’s image');
   isolated.products[0].imageUrl='/api/media/products/'+foreign.id;
   const banner=await prisma.shopMedia.create({data:{workspaceId:b.user.workspace!.id,slot:'banner',...image}});isolated.shop.bannerUrl='/api/media/assets/'+banner.id;
   await prisma.shopCommerce.update({where:{shopId:independent.id},data:{data:isolated as never}});await prisma.workspace.update({where:{id:b.user.workspace!.id},data:{published:false}});
   assert.equal((await call('/api/media/products/'+foreign.id)).status,200,'An independent published shop does not need its legacy storefront published');assert.equal((await call('/api/media/assets/'+banner.id)).status,200);
   await prisma.shop.update({where:{id:independent.id},data:{status:'DRAFT'}});assert.equal((await call('/api/media/products/'+foreign.id)).status,404);assert.equal((await call('/api/media/assets/'+banner.id)).status,404);
   await prisma.workspace.update({where:{id:b.user.workspace!.id},data:{published:true}});state.products[0].active=true;state.shop.logoUrl='/api/media/assets/'+logo.id;await prisma.workspace.update({where:{id:current.id},data:{data:state as never}});
   for(const id of [unused.id,foreign.id])assert.equal((await call('/api/media/products/'+id,a.host,undefined,undefined,a.cookie)).status,404);
   const content=initialPageContent('Notre histoire fictive');content.sections=[{id:randomUUID(),type:'image',title:'Équipe fictive',imageUrl:'/api/media/products/'+unused.id,alt:'Recette locale',caption:'',layout:'wide',fit:'cover'}];
   const page=await prisma.shopPage.create({data:{shopId:a.shop.id,slug:'histoire',draft:content as never,published:content as never,publishedAt:new Date()}});
   const imagePath='/api/v1/public/vitrines/'+a.shop.slug+'/pages/histoire/images/'+unused.id;
   assert.equal((await call('/pages/histoire',a.host)).status,200);assert.equal((await call(imagePath,a.host)).status,200);assert.equal((await call(imagePath.replace(a.shop.slug,b.shop.slug),a.host)).status,404);
   await prisma.shopPage.update({where:{id:page.id},data:{publishedAt:null}});assert.equal((await call('/pages/histoire',a.host)).status,404);assert.equal((await call(imagePath,a.host)).status,404);
   const home=initialHomeContent();home.fr.sections=[{id:randomUUID(),type:'image',title:'Visuel fictif',imageUrl:'/api/media/products/'+unused.id,alt:'Locale',caption:'',layout:'square',fit:'contain'}];await prisma.shopHome.create({data:{shopId:a.shop.id,draft:home as never,published:home as never,publishedAt:new Date()}});
   const homeImage='/api/v1/public/vitrines/'+a.shop.slug+'/images/'+unused.id;assert.equal((await call(homeImage,a.host)).status,200);assert.equal((await call('/api/media/products/'+unused.id,a.host)).status,404);
  });
  let ownTracking='',foreignTracking='';
  await t.test('Same-origin COD checkout and retries preserve one order while cross-origin and foreign checkouts fail',async()=>{
   const body={requestId:randomUUID(),customer:{name:'Acheteur fictif',phone:'22123456',city:'Tunis',address:'ADRESSE-RECETTE-PRIVEE'},items:[{productId:'p1',quantity:1}]},path='/api/boutiques/'+a.user.workspace!.slug+'/checkout';
   const before=await prisma.workspace.findUniqueOrThrow({where:{id:a.user.workspace!.id}});await rebuildActivity(a.user.id,a.shop.id);
   assert.equal((await call(path,a.host,body,'https://evil.example')).status,403);
   assert.equal((await call('/api/boutiques/'+b.user.workspace!.slug+'/checkout',a.host,body)).status,404);
   assert.equal((await call('/api/v1/public/vitrines/'+a.shop.slug+'/checkout',a.host,body)).status,404);
   const result=await call(path,a.host,body);assert.equal(result.status,201);const value=await result.json();ownTracking=value.trackingUrl;assert.match(ownTracking,/^\/suivi\/[a-f0-9]{64}$/);
   assert.equal((await call(path,a.host,body)).status,201);const after=await prisma.workspace.findUniqueOrThrow({where:{id:a.user.workspace!.id}});
   assert.equal((after.data as unknown as ReturnType<typeof initialState>).orders.length,(before.data as unknown as ReturnType<typeof initialState>).orders.length+1);assert.equal((await verifyActivity(a.user.id,a.shop.id)).matches,true);
   const foreignResult=await call('/api/boutiques/'+b.user.workspace!.slug+'/checkout',b.host,{...body,requestId:randomUUID()});assert.equal(foreignResult.status,201);foreignTracking=(await foreignResult.json()).trackingUrl;
  });
  await t.test('Tracking bearers and customer requests belong to this exact historical workspace',async()=>{
   const response=await call(ownTracking,a.host);assert.equal(response.status,200);const html=await response.text();assert.equal(html.includes('ADRESSE-RECETTE-PRIVEE'),false);assert.equal(html.includes('22123456'),false);
   assert.equal((await call(foreignTracking,a.host,undefined,undefined,a.cookie)).status,404);
   const body={id:randomUUID(),type:'CANCEL',reason:'Demande locale de recette'};
   assert.equal((await call('/api'+ownTracking,a.host,body,'https://evil.example')).status,403);assert.equal((await call('/api'+foreignTracking,a.host,body)).status,404);
   assert.equal((await call('/api'+ownTracking,a.host,body)).status,200);assert.equal((await call('/api'+ownTracking,a.host,body)).status,200);
   const row=await prisma.workspace.findUniqueOrThrow({where:{id:a.user.workspace!.id}}),state=row.data as unknown as ReturnType<typeof initialState>;assert.equal(state.orders[0].customerRequests?.length,1);assert.equal((await verifyActivity(a.user.id,a.shop.id)).matches,true);
  });
  await t.test('Stale proof, subscription and publication gates apply to both host families',async()=>{
   await prisma.shopDomainBinding.update({where:{hostname:a.host},data:{verifiedAt:new Date(Date.now()-73*3600000)}});assert.equal((await call('/',a.host)).status,404);assert.equal((await call('/api/v1/public/domains/allow?domain='+a.host)).status,403);assert.equal((await call('/',a.shop.slug+'.'+root)).status,200);
   await changeShopDomain(a.user.id,a.shop.id,{action:'verify',id:a.claim.id},async()=>[['tunicom='+a.claim.token]]);
   for(const change of [{published:false},{subscriptionStatus:'SUSPENDED'},{subscriptionEndsAt:new Date(0)}]){const original=await prisma.workspace.findUniqueOrThrow({where:{id:a.user.workspace!.id}});await prisma.workspace.update({where:{id:original.id},data:change});for(const host of [a.host,a.shop.slug+'.'+root])assert.equal((await call('/',host)).status,404);await prisma.workspace.update({where:{id:original.id},data:{published:original.published,subscriptionStatus:original.subscriptionStatus,subscriptionEndsAt:original.subscriptionEndsAt}});}
  });
  await t.test('An ownership mismatch or removed binding cannot inherit the old store domain',async()=>{
   await prisma.organization.update({where:{id:a.org.id},data:{ownerId:b.user.id}});for(const host of [a.host,a.shop.slug+'.'+root])assert.equal((await call('/',host)).status,404);
   await prisma.organization.update({where:{id:a.org.id},data:{ownerId:a.user.id}});const before=await prisma.workspace.findUniqueOrThrow({where:{id:a.user.workspace!.id}});await changeShopDomain(a.user.id,a.shop.id,{action:'remove',id:a.claim.id});assert.equal((await call('/',a.host)).status,404);assert.equal((await call('/',a.shop.slug+'.'+root)).status,200);assert.deepEqual(await prisma.workspace.findUniqueOrThrow({where:{id:before.id}}),before);
  });
 }finally{await stopTestServer(child);await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();}
});
