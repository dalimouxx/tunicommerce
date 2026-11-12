import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import type {State} from '../commerce/types';
import {homeOwner} from './home-service';
import {catalogProductRecord,catalogProductValue} from './catalog-product';
import {catalogMatches,catalogPage,catalogSearch,type CatalogQuery} from './catalog-query';
import {isDeepStrictEqual} from 'node:util';

type Shop=Awaited<ReturnType<typeof homeOwner>>;
function source(shop:Pick<Shop,'id'|'legacyWorkspaceId'>){return shop.legacyWorkspaceId?
 {sourceKind:'WORKSPACE',sourceId:shop.legacyWorkspaceId}:{sourceKind:'SHOP',sourceId:shop.id};}
async function sourceRow(tx:Prisma.TransactionClient,shop:Pick<Shop,'id'|'legacyWorkspaceId'>,data=false){
 const select={catalogVersion:true,...(data?{data:true}:{})};
 return shop.legacyWorkspaceId?tx.workspace.findUniqueOrThrow({where:{id:shop.legacyWorkspaceId},select}):
  tx.shopCommerce.findUniqueOrThrow({where:{shopId:shop.id},select});
}
function sameSource(index:{sourceKind:string;sourceId:string;sourceVersion:number},shop:Pick<Shop,'id'|'legacyWorkspaceId'>,version:number){
 const expected=source(shop);return index.sourceKind===expected.sourceKind&&index.sourceId===expected.sourceId&&index.sourceVersion===version;
}
function records(shopId:string,state:State){
 if(!Array.isArray(state.products)||state.products.length>50_000)throw new HttpError(409,'Ce catalogue nécessite une préparation par le support.');
 if(new Set(state.products.map(p=>p.id)).size!==state.products.length)throw new HttpError(409,'Le catalogue contient des identifiants de produit en double.');
 try{return state.products.map((p,i)=>catalogProductRecord(shopId,p,i));}
 catch{throw new HttpError(409,'Certains produits historiques doivent être vérifiés avant de préparer la recherche.');}
}

export async function readCatalog(userId:string,shopId:string,input:CatalogQuery){
 return prisma.$transaction(async tx=>{
  const shop=await homeOwner(userId,shopId,tx),row=await sourceRow(tx,shop);
  const index=await tx.shopCatalogIndex.findUnique({where:{shopId}});
  if(index&&sameSource(index,shop,row.catalogVersion)){
   const where:Prisma.ShopCatalogProductWhereInput={shopId,
    ...(input.status==='all'?{}:{active:input.status==='active'}),
    ...(input.stock==='low'?{lowStock:true}:input.stock==='out'?{active:true,stock:BigInt(0)}:{}),
    ...(input.q?{searchText:{contains:catalogSearch(input.q).replace(/[\\%_]/g,'\\$&')}}:{})};
   // Contradictory inactive + low/out filters return no products in both read paths.
   if(input.status==='inactive'&&input.stock!=='all')return {shopName:shop.name,source:'relational',catalogVersion:row.catalogVersion,
    ...catalogPage(0,input),products:[]};
   const total=await tx.shopCatalogProduct.count({where}),page=catalogPage(total,input);
   const products=await tx.shopCatalogProduct.findMany({where,orderBy:[{ordinal:'asc'},{productId:'asc'}],skip:page.offset,take:page.pageSize});
   return {shopName:shop.name,source:'relational',catalogVersion:row.catalogVersion,...page,products:products.map(catalogProductValue)};
  }
  const current=await sourceRow(tx,shop,true),state=current.data as unknown as State;
  const products=state.products.filter(p=>catalogMatches(p,input)),page=catalogPage(products.length,input);
  return {shopName:shop.name,source:'compatible',catalogVersion:current.catalogVersion,...page,products:products.slice(page.offset,page.offset+page.pageSize)};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
}

/** Rebuild only the disposable read model, never the merchant's commercial JSON. */
export async function rebuildCatalog(userId:string,shopId:string,force=false){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE "ownerId"=${userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Shop" WHERE id=${shopId} FOR UPDATE`;
  const shop=await homeOwner(userId,shopId,tx);
  if(!shop.legacyWorkspaceId)await tx.$queryRaw`SELECT "shopId" FROM "ShopCommerce" WHERE "shopId"=${shopId} FOR UPDATE`;
  const current=await sourceRow(tx,shop,true),index=await tx.shopCatalogIndex.findUnique({where:{shopId}});
  if(!force&&index&&sameSource(index,shop,current.catalogVersion))return {products:index.productCount,catalogVersion:current.catalogVersion,unchanged:true};
  const rows=records(shopId,current.data as unknown as State);
  const metadata={...source(shop),sourceVersion:current.catalogVersion,productCount:rows.length};
  await tx.shopCatalogIndex.upsert({where:{shopId},create:{shopId,...metadata},update:metadata});
  await tx.shopCatalogProduct.deleteMany({where:{shopId}});
  for(let i=0;i<rows.length;i+=1000)await tx.shopCatalogProduct.createMany({data:rows.slice(i,i+1000)});
  return {products:rows.length,catalogVersion:current.catalogVersion,unchanged:false};
 },{timeout:60000});
}

/** Read-only parity check for the operator; returns counts, never product content. */
export async function verifyCatalog(userId:string,shopId:string){
 return prisma.$transaction(async tx=>{
  const shop=await homeOwner(userId,shopId,tx),current=await sourceRow(tx,shop,true);
  const index=await tx.shopCatalogIndex.findUnique({where:{shopId}});
  const products=await tx.shopCatalogProduct.findMany({where:{shopId},orderBy:[{ordinal:'asc'},{productId:'asc'}]});
  const state=current.data as unknown as State;
  let mismatched=0;
  for(let i=0;i<Math.max(products.length,state.products.length);i++){
   try{if(!products[i]||!state.products[i]||!isDeepStrictEqual(catalogProductValue(products[i]),state.products[i]))mismatched++;}
   catch{mismatched++;}
  }
  const ready=!!index&&sameSource(index,shop,current.catalogVersion);
  return {ready,matches:ready&&mismatched===0&&index!.productCount===state.products.length,
   catalogVersion:current.catalogVersion,expectedProducts:state.products.length,indexedProducts:products.length,mismatchedProducts:mismatched};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
}

/** Existing ready projections follow stock/catalog changes in the same transaction. */
export async function syncCatalog(tx:Prisma.TransactionClient,scope:{shopId:string}|{workspaceId:string;ownerId:string},before:State,after:State,previousVersion:number){
 if(JSON.stringify(before.products)===JSON.stringify(after.products))return;
 const shop=await tx.shop.findUnique({where:'shopId' in scope?{id:scope.shopId}:{legacyWorkspaceId:scope.workspaceId},
  select:{id:true,legacyWorkspaceId:true,legacyWorkspace:{select:{ownerId:true}},organization:{select:{ownerId:true}},catalogIndex:true}});
 if(!shop?.catalogIndex||!sameSource(shop.catalogIndex,shop,previousVersion))return;
 if(shop.legacyWorkspaceId&&shop.legacyWorkspace?.ownerId!==shop.organization.ownerId||'ownerId' in scope&&scope.ownerId!==shop.organization.ownerId)return;
 let rows:ReturnType<typeof records>;
 try{rows=records(shop.id,after);}
 catch{await tx.shopCatalogIndex.delete({where:{shopId:shop.id}});return;}
 const old=new Map(before.products.map((p,i)=>[p.id,{json:JSON.stringify(p),ordinal:i}]));
 const changed=rows.filter((row,i)=>old.get(row.productId)?.json!==JSON.stringify(after.products[i])||old.get(row.productId)?.ordinal!==i);
 const surviving=new Set(rows.map(row=>row.productId));
 const deleted=before.products.filter(p=>!surviving.has(p.id)).map(p=>p.id);
 const ids=[...new Set([...deleted,...changed.map(p=>p.productId)])];
 if(ids.length)await tx.shopCatalogProduct.deleteMany({where:{shopId:shop.id,productId:{in:ids}}});
 for(let i=0;i<changed.length;i+=1000)await tx.shopCatalogProduct.createMany({data:changed.slice(i,i+1000)});
 const current=await sourceRow(tx,shop);
 await tx.shopCatalogIndex.update({where:{shopId:shop.id},data:{sourceVersion:current.catalogVersion,productCount:rows.length}});
}
