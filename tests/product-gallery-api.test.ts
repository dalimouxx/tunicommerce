import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
const database=process.env.TEST_DATABASE_URL;
if(!database||!new URL(database).pathname.endsWith('_test')||process.env.DATABASE_URL!==database)
 throw Error('Product gallery requires matching disposable *_test PostgreSQL databases');
process.env.MEDIA_STORAGE_MODE='database';
const {prisma}=await import('../modules/storage/client');
const {performShopInventoryAction}=await import('../modules/shops/inventory');
const {hasPublicMediaReference}=await import('../modules/media/public-reference');
const {removeProductPhoto}=await import('../modules/product-media/service');
const {HttpError}=await import('../modules/auth/http');
const mark=randomUUID().slice(0,8);
const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64'));
const url=(id:string)=>'/api/media/products/'+id;
const users:string[]=[];

async function merchant(label:string){
 const user=await prisma.user.create({data:{email:label+'-'+mark+'@example.test',name:label,passwordHash:'x',workspace:{create:{
  data:initialState(false) as never,plan:'PRO',slug:label+'-ws-'+mark,subscriptionStatus:'ACTIVE',subscriptionEndsAt:new Date(Date.now()+30*86400000)}}},include:{workspace:true}});
 users.push(user.id);
 const org=await prisma.organization.create({data:{name:label,ownerId:user.id}});
 let state=initialState(false);
 state=applyAction(state,'product',{name:'Sac '+label,sku:'SAC-'+label,category:'Mode',variant:'',price:50000,cost:20000,stock:3,threshold:1,color:'#aabbcc'});
 const shop=await prisma.shop.create({data:{organizationId:org.id,name:label,slug:label+'-'+mark,status:'PUBLISHED'}});
 await prisma.shopCommerce.create({data:{shopId:shop.id,data:state as object}});
 await prisma.membership.create({data:{shopId:shop.id,userId:user.id,role:'OWNER'}});
 const photos=[];
 for(let i=0;i<3;i++)photos.push((await prisma.productMedia.create({data:{workspaceId:user.workspace!.id,content:png,mimeType:'image/png',size:png.length,width:1,height:1}})).id);
 return {user,workspaceId:user.workspace!.id,shop,product:state.products.find(p=>p.sku==='SAC-'+label)!,photos};
}
const rejects=async(promise:Promise<unknown>,status:number)=>{await assert.rejects(promise,(error:unknown)=>error instanceof HttpError&&error.status===status);};
const save=(m:Awaited<ReturnType<typeof merchant>>,photos:{imageUrl?:string;gallery?:string[]})=>performShopInventoryAction(m.user.id,m.shop.id,{action:'product',requestId:randomUUID(),payload:{
 id:m.product.id,name:m.product.name,sku:m.product.sku,category:m.product.category,variant:'',price:m.product.price,cost:m.product.cost,stock:m.product.stock,threshold:m.product.threshold,color:m.product.color,...photos}});

test('Product gallery: owner photos only, public through an active product, protected from deletion',async t=>{
 try{
  const a=await merchant('galerie-a'),b=await merchant('galerie-b');
  await t.test('An independent shop saves library photos of its owner as main photo and gallery',async()=>{
   const result=await save(a,{imageUrl:url(a.photos[0]),gallery:[url(a.photos[1]),url(a.photos[2])]});
   const product=result.state.products.find(p=>p.id===a.product.id)!;
   assert.equal(product.imageUrl,url(a.photos[0]));assert.deepEqual(product.gallery,[url(a.photos[1]),url(a.photos[2])]);
  });
  await t.test('A photo of another merchant is refused, in the gallery as for the main photo',async()=>{
   await rejects(save(a,{imageUrl:url(a.photos[0]),gallery:[url(b.photos[0])]}),403);
   await rejects(save(a,{imageUrl:url(b.photos[0])}),403);
   await rejects(save(a,{gallery:[url(randomUUID())]}),403);
   const row=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:a.shop.id}});
   assert.deepEqual((row.data as {products:{id:string;gallery?:string[]}[]}).products.find(p=>p.id===a.product.id)!.gallery,[url(a.photos[1]),url(a.photos[2])]);
  });
  await t.test('Gallery photos are public only while an active product of a published shop uses them',async()=>{
   assert.equal(await hasPublicMediaReference(a.workspaceId,a.user.id,url(a.photos[2]),'product'),true);
   assert.equal(await hasPublicMediaReference(b.workspaceId,b.user.id,url(b.photos[2]),'product'),false);
   assert.equal(await hasPublicMediaReference(b.workspaceId,a.user.id,url(a.photos[2]),'product'),false);
   await prisma.shop.update({where:{id:a.shop.id},data:{status:'DRAFT'}});
   assert.equal(await hasPublicMediaReference(a.workspaceId,a.user.id,url(a.photos[2]),'product'),false);
   await prisma.shop.update({where:{id:a.shop.id},data:{status:'PUBLISHED'}});
  });
  await t.test('A photo used in a gallery cannot be deleted; once removed from the product it can',async()=>{
   await rejects(removeProductPhoto(a.user.id,a.photos[2]),409);
   await rejects(removeProductPhoto(a.user.id,a.photos[0]),409);
   await save(a,{imageUrl:url(a.photos[0]),gallery:[url(a.photos[1])]});
   assert.deepEqual(await removeProductPhoto(a.user.id,a.photos[2]),{ok:true});
   assert.equal(await prisma.productMedia.count({where:{id:a.photos[2]}}),0);
  });
  await t.test('The historical shop protects its gallery photos too',async()=>{
   const workspace=await prisma.workspace.findUniqueOrThrow({where:{id:b.workspaceId}});
   const state=applyAction(workspace.data as never,'product',{name:'Lampe',sku:'LAMPE-1',category:'Maison',variant:'',price:1000,cost:0,stock:1,threshold:0,color:'#aabbcc',imageUrl:url(b.photos[0]),gallery:[url(b.photos[1])]});
   await prisma.workspace.update({where:{id:b.workspaceId},data:{data:state as object}});
   await rejects(removeProductPhoto(b.user.id,b.photos[1]),409);
   assert.deepEqual(await removeProductPhoto(b.user.id,b.photos[2]),{ok:true});
  });
 }finally{
  for(const id of users){
   await prisma.shop.deleteMany({where:{organization:{ownerId:id}}});
   await prisma.organization.deleteMany({where:{ownerId:id}});
   await prisma.user.deleteMany({where:{id}});
  }
  await prisma.$disconnect();
 }
});
