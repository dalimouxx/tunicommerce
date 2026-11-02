import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {Prisma} from '@prisma/client';
import {setTimeout as delay} from 'node:timers/promises';

const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('_test'))throw Error('Dedicated *_test database required');
process.env.DATABASE_URL=url;

const {prisma}=await import('../modules/storage/client');
const {hashPassword}=await import('../modules/auth/crypto');
const {initialState}=await import('../modules/commerce/seed');
const base='http://127.0.0.1:3147';
const origin='https://test.local';
const password='Portal-test-password-2026';
const setupToken=randomBytes(32).toString('hex');
let child:ChildProcess|undefined;

const get=(path:string,cookie='',redirect:'manual'|'follow'='manual')=>fetch(base+path,{headers:{cookie},redirect});
const post=(path:string,cookie:string,body:unknown)=>fetch(base+path,{
 method:'POST',headers:{origin,cookie,'content-type':'application/json'},
 body:JSON.stringify(body),redirect:'manual'
});
async function cookieFor(email:string){
 const response=await post('/api/auth/login','',{email,password});
 assert.equal(response.status,200);
 return response.headers.get('set-cookie')!.split(';')[0];
}
async function reset(){
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

test('Platform, merchant and public shop portals stay strictly separate',async t=>{
 try{
  await reset();
  child=spawn(process.execPath,['scripts/start.mjs'],{
   env:{...process.env,NODE_ENV:'production',PORT:'3147',DATABASE_URL:url,APP_URL:origin,SETUP_TOKEN:setupToken},
   stdio:'ignore'
  });
  let ready=false;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error('Server exited');
   try{if((await get('/api/health')).ok){ready=true;break;}}catch{}
   await delay(250);
  }
  assert.equal(ready,true,'Next.js HTTP server ready');

  await t.test('Anonymous visitors see login; no protected data leaked',async()=>{
   const root=await get('/');
   assert.equal(root.status,307);
   assert.ok(root.headers.get('location')?.includes('/login'));
   assert.equal((await get('/admin')).status,307);
   assert.equal((await get('/marchand')).status,307);
   assert.equal((await get('/mes-boutiques')).status,307);
   assert.equal((await get('/admin/gestion-boutiques')).status,307);
   assert.equal((await get('/boutiques')).status,200);
  });

  assert.equal((await post('/api/auth/setup','',{
   email:'admin@example.test',name:'Platform Owner',password,token:setupToken
  })).status,201);
  const adminCookie=await cookieFor('admin@example.test');

  await t.test('Superadministrator enters platform instead of a fake personal shop',async()=>{
   const home=await get('/',adminCookie);
   assert.equal(home.status,307);
   assert.ok(home.headers.get('location')?.endsWith('/admin'));
   const merchant=await get('/marchand',adminCookie);
   assert.equal(merchant.status,307);
   assert.ok(merchant.headers.get('location')?.endsWith('/admin'));
   const ownShops=await get('/mes-boutiques',adminCookie);
   assert.equal(ownShops.status,200);
   assert.ok((await ownShops.text()).includes('Aucune boutique associée'));
   const admin=await get('/admin',adminCookie);
   assert.equal(admin.status,200);
   const html=await admin.text();
   assert.ok(html.includes('Administration globale'));
   assert.ok(html.includes('Aucune boutique marchande pour le moment'));
   assert.ok(html.includes('Gestion centrale'));
   assert.ok(!html.includes('Vue d’ensemble</h1>'));
   const management=await get('/admin/gestion-boutiques',adminCookie);
   assert.equal(management.status,200);
   assert.ok((await management.text()).includes('Créer une boutique et son marchand'));
   assert.equal(await prisma.workspace.count(),0,'No phantom workspace for platform administrator');
  });

  const shopInput={
   action:'create',name:'Sousse Merchant',email:'merchant@example.test',
   password,shopName:'Sousse Mode',slug:'sousse-mode',published:true,
   plan:'PRO',subscriptionStatus:'ACTIVE',
   subscriptionEndsAt:new Date(Date.now()+30*86400000).toISOString()
  };
  assert.equal((await post('/api/admin/shops',adminCookie,shopInput)).status,200);
  const merchantCookie=await cookieFor(shopInput.email);

  await t.test('Merchant uses only private commerce and sees real public storefront',async()=>{
   assert.equal((await get('/',merchantCookie)).status,307);
   assert.ok((await get('/',merchantCookie)).headers.get('location')?.endsWith('/marchand'));
   assert.equal((await get('/admin',merchantCookie)).status,307);
   assert.ok((await get('/admin',merchantCookie)).headers.get('location')?.endsWith('/marchand'));
   assert.equal((await get('/admin/gestion-boutiques',merchantCookie)).status,307);
   const merchant=await get('/marchand',merchantCookie);
   assert.equal(merchant.status,200);
   const html=await merchant.text();
   assert.ok(html.includes('Espace marchand'));
   assert.ok(html.includes('Voir ma boutique publiée'));
   assert.ok(html.includes('Équipe et accès'));
   assert.ok(html.includes('Mes boutiques'));
   const merchantWorkspace=await prisma.workspace.findUniqueOrThrow({where:{slug:'sousse-mode'},include:{shop:true}});
   assert.ok(merchantWorkspace.shop?.id);
   const ownShopOverview=await get('/mes-boutiques/'+merchantWorkspace.shop!.id,merchantCookie);
   assert.equal(ownShopOverview.status,200);
   assert.ok((await ownShopOverview.text()).includes('COD non encaissé'));
   const crossShopOverview=await get('/mes-boutiques/'+merchantWorkspace.shop!.id,adminCookie);
   assert.equal(crossShopOverview.status,404);
   const personalShops=await get('/mes-boutiques',merchantCookie);
   assert.equal(personalShops.status,200);
   const personalHtml=await personalShops.text();
   assert.ok(personalHtml.includes('Sousse Mode'));
   assert.ok(!personalHtml.includes('Demo Store'));
   assert.ok(!html.includes('Administration globale</a>'));
   const catalog=await get('/boutiques/sousse-mode');
   assert.equal(catalog.status,200);
   assert.ok((await catalog.text()).includes('Sousse Mode'));
   const directory=await get('/boutiques');
   assert.equal(directory.status,200);
   assert.ok((await directory.text()).includes('Sousse Mode'));
   const admin=await get('/admin',adminCookie);
   assert.equal(admin.status,200);
   const adminHtml=await admin.text();
   assert.ok(adminHtml.includes('Sousse Mode'));
   assert.ok(adminHtml.includes('Sousse Merchant'));
   assert.ok(!adminHtml.includes('admin@example.test</small></td>'));
   assert.equal(await prisma.workspace.count(),1);
  });

  await t.test('Isolated new shop initializes once and never reads another merchant workspace',async()=>{
   const owner=await prisma.user.findUniqueOrThrow({where:{email:'merchant@example.test'}});
   const org=await prisma.organization.create({data:{name:'Merchant second organization',ownerId:owner.id}});
   const fresh=await prisma.shop.create({data:{
    organizationId:org.id,name:'Deuxième boutique',slug:'merchant-second-shop',
    memberships:{create:{userId:owner.id,role:'OWNER'}}
   }});
   const path='/api/v1/shops/'+fresh.id+'/commerce';
   assert.equal((await get(path)).status,401,'anonymous forbidden');
   const forbidden=await get(path,adminCookie);
   assert.equal(forbidden.status,404,'global admin has no implicit access');
   const before=await get(path,merchantCookie);
   assert.equal(before.status,200);
   const freshState=await before.json() as {initialized:boolean;state:{orders:unknown[];products:unknown[]}};
   assert.equal(freshState.initialized,false);
   assert.equal(freshState.state.orders.length,0);
   assert.equal(freshState.state.products.length,0);
   assert.equal(await prisma.shopCommerce.count({where:{shopId:fresh.id}}),0,'GET must not persist');
   assert.equal((await post(path,adminCookie,{action:'initialize'})).status,404);
   const first=await post(path,merchantCookie,{action:'initialize'});
   assert.equal(first.status,200);
   const firstVersion=(await first.json() as {version:number}).version;
   assert.equal((await post(path,merchantCookie,{action:'initialize'})).status,200);
   assert.equal((await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:fresh.id}})).version,firstVersion);
   const afterward=await get(path,merchantCookie);
   assert.equal((await afterward.json() as {initialized:boolean}).initialized,true);
   assert.equal((await get('/mes-boutiques/'+fresh.id,merchantCookie)).status,200);
   // Isolated inventory uses the dedicated ShopCommerce row, never the legacy Workspace.
   const inventoryPath='/api/v1/shops/'+fresh.id+'/inventory';
   assert.equal((await get(inventoryPath)).status,401);
   assert.equal((await get(inventoryPath,adminCookie)).status,404);
   assert.equal((await post(inventoryPath,adminCookie,{action:'stock',payload:{},requestId:'123e4567-e89b-42d3-a456-426614174001'})).status,404);
   const requestId='123e4567-e89b-42d3-a456-426614174002';
   const productInput={action:'product',requestId,payload:{
    name:'Chemise',sku:'CHEMISE-01',category:'Mode',variant:'Bleu',
    price:40000,cost:20000,stock:5,threshold:2,color:'#aabbcc'
   }};
   const created=await post(inventoryPath,merchantCookie,productInput);
   assert.equal(created.status,200);
   const data=await created.json() as {products:{id:string;stock:number}[];version:number};
   assert.equal(data.products.length,1);
   assert.equal(data.products[0].stock,5);
   const replay=await post(inventoryPath,merchantCookie,productInput);
   assert.equal(replay.status,200);
   assert.equal((await replay.json() as {version:number}).version,data.version);
   const invalid=await post(inventoryPath,merchantCookie,{action:'reset',requestId:'123e4567-e89b-42d3-a456-426614174003',payload:{}});
   assert.equal(invalid.status,400);
   const adjusted=await post(inventoryPath,merchantCookie,{action:'stock',requestId:'123e4567-e89b-42d3-a456-426614174004',payload:{
    id:data.products[0].id,quantity:-2,reason:'Inventaire physique'
   }});
   assert.equal(adjusted.status,200);
   assert.equal((await adjusted.json() as {products:{stock:number}[]}).products[0].stock,3);
   assert.equal((await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:fresh.id}})).version,data.version+1);
   const merchantProductList=await get(inventoryPath,merchantCookie);
   assert.equal(merchantProductList.status,200);
   assert.equal((await merchantProductList.json() as {products:unknown[]}).products.length,1);
   const orderPath='/api/v1/shops/'+fresh.id+'/orders';
   assert.equal((await get(orderPath)).status,401);
   assert.equal((await get(orderPath,adminCookie)).status,404);
   assert.equal((await post(orderPath,adminCookie,{action:'createOrder',payload:{},requestId:'123e4567-e89b-42d3-a456-426614174013'})).status,404);
   const orderRequest={action:'createOrder',requestId:'123e4567-e89b-42d3-a456-426614174014',payload:{
    name:'Commande pilote',phone:'22123456',city:'Gabès',address:'Rue des tests',
    source:'Manuel',items:[{productId:data.products[0].id,quantity:1}]
   }};
   const createdOrder=await post(orderPath,merchantCookie,orderRequest);
   assert.equal(createdOrder.status,200);
   const orderData=await createdOrder.json() as {orders:{id:string;status:string}[];version:number};
   assert.equal(orderData.orders.length,1);
   assert.equal(orderData.orders[0].status,'TO_CONFIRM');
   const replayOrder=await post(orderPath,merchantCookie,orderRequest);
   assert.equal(replayOrder.status,200);
   assert.equal((await replayOrder.json() as {version:number}).version,orderData.version);
   const notAllowed=await post(orderPath,merchantCookie,{action:'settlement',requestId:'123e4567-e89b-42d3-a456-426614174015',payload:{}});
   assert.equal(notAllowed.status,400);
   const afterOrders=await get(orderPath,merchantCookie);
   assert.equal(afterOrders.status,200);
   assert.equal((await afterOrders.json() as {orders:unknown[]}).orders.length,1);
   const inventoryAfterOrder=await get(inventoryPath,merchantCookie);
   assert.equal((await inventoryAfterOrder.json() as {products:{stock:number}[]}).products[0].stock,2);
   // Global merchant quota spans both isolated boutiques, not just the selected shop.
   const billingWorkspace=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
   await prisma.workspacePlanOverride.upsert({
    where:{workspaceId:billingWorkspace.id},
    create:{workspaceId:billingWorkspace.id,maxProducts:2,maxOrdersPerMonth:2},
    update:{maxProducts:2,maxOrdersPerMonth:2}
   });
   const otherShop=await prisma.shop.create({data:{
    organizationId:org.id,name:'Troisième boutique',slug:'third-independent-shop',
    memberships:{create:{userId:owner.id,role:'OWNER'}}
   }});
   const otherCommerce='/api/v1/shops/'+otherShop.id+'/commerce';
   assert.equal((await post(otherCommerce,merchantCookie,{action:'initialize'})).status,200);
   const otherInventory='/api/v1/shops/'+otherShop.id+'/inventory';
   const secondProduct={action:'product',requestId:'123e4567-e89b-42d3-a456-426614174016',payload:{
    name:'Deuxième produit',sku:'PROD-02',category:'Mode',variant:'',price:12000,
    cost:3000,stock:2,threshold:1,color:'#aabbcc'
   }};
   assert.equal((await post(otherInventory,merchantCookie,secondProduct)).status,200);
   const exceed={...secondProduct,requestId:'123e4567-e89b-42d3-a456-426614174017',
    payload:{...secondProduct.payload,name:'Troisième produit',sku:'PROD-03'}};
   const rejected=await post(inventoryPath,merchantCookie,exceed);
   assert.equal(rejected.status,409);
   assert.match((await rejected.json() as {error:string}).error,/Plafond global/);
   const allStates=await prisma.shopCommerce.findMany({
    where:{shopId:{in:[fresh.id,otherShop.id]}},select:{data:true}
   });
   assert.equal(allStates.reduce((total,row)=>total+((row.data as unknown as {products:unknown[]}).products.length),0),2);
   // Independent shop: active team members see only their explicitly granted sections.
   for(const [email,role] of [
    ['stock@example.test','STOCK'],
    ['calls@example.test','CALL_CENTER'],
    ['finance@example.test','ACCOUNTANT'],
    ['viewer@example.test','VIEWER']
   ]){
    const employee=await prisma.user.create({data:{
     email,name:role,passwordHash:await hashPassword(password),role:'MERCHANT'
    }});
    await prisma.membership.create({data:{shopId:fresh.id,userId:employee.id,role,active:true}});
   }
   const stockCookie=await cookieFor('stock@example.test');
   const callsCookie=await cookieFor('calls@example.test');
   const financeCookie=await cookieFor('finance@example.test');
   const viewerCookie=await cookieFor('viewer@example.test');
   const teamView=(shop:string,section:string)=>'/api/v1/shops/'+shop+'/team-view?section='+section;
   assert.equal((await get(teamView(fresh.id,'orders'))).status,401);
   assert.equal((await get(teamView(fresh.id,'orders'),adminCookie)).status,404);
   assert.equal((await get(teamView(fresh.id,'finance'),stockCookie)).status,403);
   assert.equal((await get(teamView(fresh.id,'products'),financeCookie)).status,403);
   assert.equal((await get(teamView(fresh.id,'finance'),financeCookie)).status,200);
   assert.equal((await get(teamView(fresh.id,'products'),stockCookie)).status,200);
   assert.equal((await get(teamView(fresh.id,'orders'),callsCookie)).status,200);
   const callBody=JSON.stringify(await (await get(teamView(fresh.id,'orders'),callsCookie)).json());
   assert.ok(callBody.includes('22123456'));
   assert.ok(!callBody.includes('Rue des tests'));
   const viewBody=JSON.stringify(await (await get(teamView(fresh.id,'orders'),viewerCookie)).json());
   assert.ok(!viewBody.includes('22123456'));
   assert.ok(!viewBody.includes('Commande pilote'));
   assert.ok(!viewBody.includes('"total"'));
   const financial=JSON.stringify(await (await get(teamView(fresh.id,'finance'),financeCookie)).json());
   assert.ok(!financial.includes('22123456'));
   assert.equal((await get(teamView(otherShop.id,'products'),stockCookie)).status,404);
   const teamDashboard=await get('/mes-boutiques/'+fresh.id,stockCookie);
   assert.equal(teamDashboard.status,200);
   assert.ok((await teamDashboard.text()).includes('Espace collaborateur'));
   // A teammate cannot mutate stock or orders through the owner-only APIs.
   assert.equal((await post(inventoryPath,stockCookie,{action:'stock',requestId:'123e4567-e89b-42d3-a456-426614174018',payload:{
    id:data.products[0].id,quantity:1,reason:'Opération interdite'
   }})).status,403);
   assert.equal((await post(orderPath,callsCookie,{action:'note',requestId:'123e4567-e89b-42d3-a456-426614174019',payload:{
    id:orderData.orders[0].id,note:'Tentative interdite'
   }})).status,403);
   const employee=await prisma.user.findUniqueOrThrow({where:{email:'stock@example.test'}});
   await prisma.membership.update({where:{shopId_userId:{shopId:fresh.id,userId:employee.id}},data:{active:false}});
   assert.equal((await get(teamView(fresh.id,'products'),stockCookie)).status,404);
   const original=await prisma.workspace.findUniqueOrThrow({where:{ownerId:owner.id}});
   assert.equal(original.slug,'sousse-mode','old linked Workspace untouched');
  });

  await t.test('Members invited to a team do not create phantom merchant shops',async()=>{
   const user=await prisma.user.create({data:{
    email:'employee@example.test',name:'Team Member',passwordHash:await hashPassword(password),role:'MERCHANT'
   }});
   const admin=await prisma.user.findUniqueOrThrow({where:{email:'admin@example.test'}});
   const org=await prisma.organization.create({data:{name:'Sousse Org',ownerId:admin.id}});
   await prisma.shop.create({data:{
    organizationId:org.id,name:'Team Test Shop',slug:'team-test-shop',
    memberships:{create:{userId:user.id,role:'VIEWER'}}
   }});
   const memberCookie=await cookieFor('employee@example.test');
   const member=await get('/marchand',memberCookie);
   assert.equal(member.status,307);
   assert.ok(member.headers.get('location')?.endsWith('/equipe'));
   assert.equal(await prisma.workspace.count(),1);
   assert.equal((await get('/equipe',memberCookie)).status,200);
   const memberDirectory=await get('/mes-boutiques',memberCookie);
   assert.equal(memberDirectory.status,200);
   const teamHtml=await memberDirectory.text();
   assert.ok(teamHtml.includes('Team Test Shop'));
   assert.ok(!teamHtml.includes('Sousse Mode'));
   assert.ok(!teamHtml.includes('Gérer ma boutique'));
   assert.ok(teamHtml.includes('Gestion de l’équipe')||teamHtml.includes('Gestion de l\'équipe'));
   const teamShop=await prisma.shop.findUniqueOrThrow({where:{slug:'team-test-shop'}});
   const teamOverview=await get('/mes-boutiques/'+teamShop.id,memberCookie);
   assert.equal(teamOverview.status,200);
   const overviewHtml=await teamOverview.text();
   assert.ok(overviewHtml.includes('Vue commerciale indisponible'));
   assert.ok(!overviewHtml.includes('COD non encaissé'));
   const merchantWorkspace=await prisma.workspace.findUniqueOrThrow({where:{slug:'sousse-mode'},include:{shop:true}});
   assert.equal((await get('/mes-boutiques/'+merchantWorkspace.shop!.id,memberCookie)).status,404);
   assert.equal((await get('/admin',memberCookie)).status,307);
  });
  await t.test('Existing platform-owned public demo store is clearly identified, not hidden',async()=>{
   const adminUser=await prisma.user.findUniqueOrThrow({where:{email:'admin@example.test'}});
   const state=initialState(false);
   state.shop.name='Demo Store';
   await prisma.workspace.create({data:{
    ownerId:adminUser.id,data:state as unknown as Prisma.InputJsonValue,
    slug:'platform-demo',published:true,plan:'STARTER',subscriptionStatus:'TRIAL',
    subscriptionEndsAt:new Date(Date.now()+30*86400000)
   }});
   const response=await get('/admin',adminCookie);
   assert.equal(response.status,200);
   const html=await response.text();
   assert.ok(html.includes('Demo Store'));
   assert.ok(html.includes('Boutique historique du compte plateforme'));
   assert.ok(html.includes('platform-demo'));
   const managed=await get('/admin/gestion-boutiques',adminCookie);
   assert.equal(managed.status,200);
   assert.ok((await managed.text()).includes('Demo Store'));
   assert.equal((await get('/boutiques/platform-demo')).status,200);
   assert.equal(await prisma.user.count({where:{role:'MERCHANT'}}),6,'Two original merchants and four explicitly created team members');
  });
 }finally{
  child?.kill('SIGTERM');
  await prisma.$disconnect();
 }
});
