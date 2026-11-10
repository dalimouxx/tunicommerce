import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {Prisma} from '@prisma/client';
import {stopTestServer} from './server-process';
import {initialPageContent,type PageEditorRecord} from '../modules/shops/page-content';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)throw Error('Matching disposable *_test database required');
const {prisma}=await import('../modules/storage/client');
const {hashPassword}=await import('../modules/auth/crypto');
const {newShopState}=await import('../modules/shops/isolated-commerce');
const origin='https://pages.example.test',base='http://127.0.0.1:3195',mark=randomUUID().slice(0,8),password='Shop-Pages-Fixture-2026!';
let server:ChildProcess|undefined,userId='',otherId='',organizationId='',otherOrg='',shopId='',secondId='',otherShop='',cookie='',otherCookie='';
let page:PageEditorRecord;
const slug='pages-'+mark;
const get=(path:string,session='')=>fetch(base+path,{headers:{cookie:session},redirect:'manual'});
const write=(path:string,body:unknown,session=cookie,method='POST',from=origin)=>fetch(base+path,{method,headers:{cookie:session,origin:from,'content-type':'application/json'},body:JSON.stringify(body),redirect:'manual'});
const api=()=>'/api/v1/shops/'+shopId+'/pages';
const publicPath=()=>'/vitrines/'+slug+'/pages/a-propos';
async function update(action:'save'|'publish'|'unpublish',content?:unknown){
 const response=await write(api()+'/'+page.id,{action,version:page.version,...(content?{content}:{})},cookie,'PUT');
 if(response.ok)page=(await response.json()).page;return response;
}
async function login(email:string){const response=await write('/api/auth/merchant/login',{email,password},'');assert.equal(response.status,200);return response.headers.get('set-cookie')!.split(';')[0];}
test('Shop page lifecycle: tenant isolation, snapshots, concurrency and publication gates',async t=>{
 try{
  const passwordHash=await hashPassword(password),state=newShopState('Pages fixture') as unknown as Prisma.InputJsonValue;
  userId=(await prisma.user.create({data:{email:'pages-'+mark+'@example.test',name:'Page owner',passwordHash,workspace:{create:{data:state,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)}}}})).id;
  otherId=(await prisma.user.create({data:{email:'other-pages-'+mark+'@example.test',name:'Other owner',passwordHash,workspace:{create:{data:state,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)}}}})).id;
  organizationId=(await prisma.organization.create({data:{ownerId:userId,name:'Page organization'}})).id;
  otherOrg=(await prisma.organization.create({data:{ownerId:otherId,name:'Other page organization'}})).id;
  async function shop(organization:string,owner:string,shopSlug:string){return (await prisma.shop.create({data:{organizationId:organization,name:'Pages fixture',slug:shopSlug,commerce:{create:{data:state}},memberships:{create:{userId:owner,role:'OWNER'}}}})).id;}
  shopId=await shop(organizationId,userId,slug);secondId=await shop(organizationId,userId,slug+'-two');otherShop=await shop(otherOrg,otherId,slug+'-other');
  await prisma.membership.create({data:{shopId,userId:otherId,role:'ADMIN'}});
  server=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,NODE_ENV:'production',APP_URL:origin,DATABASE_URL:database,PORT:'3195'},stdio:'ignore'});
  let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('App exited');try{if((await get('/api/health')).ok){ready=true;break;}}catch{}await pause(250);}assert.ok(ready);
  cookie=await login('pages-'+mark+'@example.test');otherCookie=await login('other-pages-'+mark+'@example.test');
  await t.test('Only the actual active owner can create/read pages; input cannot grant extra powers',async()=>{
   const input={slug:'a-propos',content:initialPageContent('Notre histoire publiée')};
   assert.equal((await write(api(),input,'')).status,401);
   assert.equal((await write(api(),input,otherCookie)).status,403);
   await prisma.membership.update({where:{shopId_userId:{shopId,userId:otherId}},data:{role:'OWNER'}});
   assert.equal((await write(api(),input,otherCookie)).status,403);
   await prisma.membership.update({where:{shopId_userId:{shopId,userId:otherId}},data:{active:false}});
   assert.equal((await get(api(),otherCookie)).status,404);
   await prisma.membership.update({where:{shopId_userId:{shopId,userId:otherId}},data:{role:'ADMIN',active:true}});
   assert.equal((await write(api(),input,cookie,'POST','https://evil.example')).status,403);
   assert.equal((await write(api(),{...input,ownerId:otherId})).status,400);
   const created=await write(api(),input);assert.equal(created.status,201);page=(await created.json()).page;
   assert.equal((await get('/mes-boutiques/'+shopId+'/pages',cookie)).status,200);
   assert.equal((await get('/mes-boutiques/'+shopId+'/pages',otherCookie)).status,404);
   assert.equal((await get('/mes-boutiques/'+shopId+'/pages')).status,307);
  });
  await t.test('Draft is private, preview stays private and a draft shop cannot publish pages',async()=>{
   assert.equal((await get(publicPath())).status,404);
   const preview='/mes-boutiques/'+shopId+'/pages/'+page.id+'/apercu';
   const response=await get(preview,cookie);assert.equal(response.status,200);
   assert.ok((await response.text()).includes('Notre histoire publiée'));
   assert.ok(response.headers.get('cache-control')?.includes('no-store'));
   assert.equal(response.headers.get('referrer-policy'),'no-referrer');
   assert.equal((await get(preview,otherCookie)).status,404);assert.equal((await get(preview)).status,307);
   assert.equal((await update('publish')).status,409);
   const cross=await write('/api/v1/shops/'+secondId+'/pages/'+page.id,{action:'publish',version:page.version},cookie,'PUT');assert.equal(cross.status,404);
  });
  await t.test('Publication exposes only an explicit snapshot and storefront navigation uses that snapshot',async()=>{
   await prisma.shop.update({where:{id:shopId},data:{status:'PUBLISHED'}});
   assert.equal((await update('publish')).status,200);
   let html=await (await get(publicPath())).text();assert.ok(html.includes('Notre histoire publiée'));
   const draft={...page.draft,title:'Brouillon secret non publié',sections:[{id:randomUUID(),type:'text',title:'Détail',text:'<script>window.hacked=true</script>'}]};
   assert.equal((await update('save',draft)).status,200);
   html=await (await get(publicPath())).text();assert.ok(html.includes('Notre histoire publiée'));assert.equal(html.includes('Brouillon secret non publié'),false);
   const home=await (await get('/vitrines/'+slug)).text();assert.ok(home.includes('/pages/a-propos'));assert.ok(home.includes('Notre histoire publiée'));assert.equal(home.includes('Brouillon secret non publié'),false);
   assert.equal((await update('publish')).status,200);
   html=await (await get(publicPath())).text();assert.ok(html.includes('Brouillon secret non publié'));
   assert.equal(html.includes('<script>window.hacked=true</script>'),false);assert.ok(html.includes('&lt;script&gt;window.hacked=true&lt;/script&gt;'));
  });
  await t.test('Concurrent saves reject stale writes; publication cannot overwrite unsaved fields',async()=>{
   const version=page.version;
   const responses=await Promise.all(['Winning one','Winning two'].map(title=>write(api()+'/'+page.id,{action:'save',version,content:{...page.draft,title}},cookie,'PUT')));
   assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);page=(await responses.find(r=>r.status===200)!.json()).page;
   assert.equal((await write(api()+'/'+page.id,{action:'publish',version},cookie,'PUT')).status,409);
   assert.equal((await write(api()+'/'+page.id,{action:'publish',version:page.version,content:page.draft},cookie,'PUT')).status,400);
   assert.ok((await (await get(publicPath())).text()).includes('Brouillon secret non publié'));
   assert.equal((await update('publish')).status,200);assert.ok((await (await get(publicPath())).text()).includes(page.draft.title));
  });
  await t.test('Subscription expiry/suspension and shop withdrawal hide public pages immediately',async()=>{
   for(const values of [{subscriptionStatus:'SUSPENDED'},{subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(0)}]){
    await prisma.workspace.update({where:{ownerId:userId},data:values});assert.equal((await get(publicPath())).status,404);assert.equal((await update('publish')).status,409);
   }
   await prisma.workspace.update({where:{ownerId:userId},data:{subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+86400000)}});
   await prisma.shop.update({where:{id:shopId},data:{status:'DRAFT'}});assert.equal((await get(publicPath())).status,404);
   await prisma.shop.update({where:{id:shopId},data:{status:'PUBLISHED'}});assert.equal((await get(publicPath())).status,200);
   assert.equal((await update('unpublish')).status,200);assert.equal((await get(publicPath())).status,404);
   assert.equal((await (await get('/vitrines/'+slug)).text()).includes('/pages/a-propos'),false);
  });
  await t.test('Slugs are scoped to a shop and the ten-page ceiling survives concurrent creates',async()=>{
   const content=initialPageContent();assert.equal((await write(api(),{slug:'a-propos',content})).status,409);
   assert.equal((await write('/api/v1/shops/'+secondId+'/pages',{slug:'a-propos',content})).status,201);
   for(let i=0;i<8;i++)assert.equal((await write(api(),{slug:'extra-'+i,content})).status,201);
   const responses=await Promise.all(['last-one','last-two'].map(extra=>write(api(),{slug:extra,content})));
   assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);assert.equal(await prisma.shopPage.count({where:{shopId}}),10);
  });
  await t.test('Withdrawal, stale deletion and cross-shop deletion preserve other pages',async()=>{
   assert.equal((await write('/api/v1/shops/'+otherShop+'/pages/'+page.id,{version:page.version},otherCookie,'DELETE')).status,404);
   assert.equal((await write(api()+'/'+page.id,{version:page.version-1},cookie,'DELETE')).status,409);
   assert.equal((await write(api()+'/'+page.id,{version:page.version},cookie,'DELETE')).status,200);
   assert.equal((await get('/mes-boutiques/'+shopId+'/pages/'+page.id+'/apercu',cookie)).status,404);
   assert.equal(await prisma.shopPage.count({where:{shopId:secondId}}),1);
  });
 }finally{
  if(server&&server.exitCode===null){const exited=once(server,'exit');stopTestServer(server);await exited;}
  await prisma.organization.deleteMany({where:{id:{in:[organizationId,otherOrg].filter(Boolean)}}});
  await prisma.user.deleteMany({where:{id:{in:[userId,otherId].filter(Boolean)}}});await prisma.$disconnect();
 }
});
