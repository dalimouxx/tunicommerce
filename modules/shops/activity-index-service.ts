import {Prisma} from '@prisma/client';
import {isDeepStrictEqual} from 'node:util';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import type {State} from '../commerce/types';
import {homeOwner} from './home-service';
import {activityPage,activitySearch,type ActivityQuery,type ActivityResponse} from './activity-query';
import {activityRecords,activityOrderSummary,activityCustomerSummary} from './activity-records';
type Scope={id:string;legacyWorkspaceId:string|null};
function source(shop:Scope){return shop.legacyWorkspaceId?{sourceKind:'WORKSPACE',sourceId:shop.legacyWorkspaceId}:{sourceKind:'SHOP',sourceId:shop.id};}
function matches(index:{sourceKind:string;sourceId:string;sourceVersion:number},shop:Scope,version:number){const expected=source(shop);return index.sourceKind===expected.sourceKind&&index.sourceId===expected.sourceId&&index.sourceVersion===version;}
async function sourceRow(tx:Prisma.TransactionClient,shop:Scope,data=false){const select={activityVersion:true,...(data?{data:true}:{})};return shop.legacyWorkspaceId?tx.workspace.findUniqueOrThrow({where:{id:shop.legacyWorkspaceId},select}):tx.shopCommerce.findUniqueOrThrow({where:{shopId:shop.id},select});}
function records(shopId:string,state:State){try{return activityRecords(shopId,state);}catch{throw new HttpError(409,'Ces données historiques nécessitent une préparation par le support. Aucune donnée commerciale n’a été modifiée.');}}
const orderSelect={orderId:true,reference:true,status:true,source:true,total:true,collected:true,createdAt:true,customerName:true,customerPhone:true,customerCity:true} as const;
const customerSelect={customerId:true,name:true,phone:true,city:true,orderCount:true,deliveredCount:true,deliveredGross:true} as const;

export async function readActivity(userId:string,shopId:string,input:ActivityQuery):Promise<ActivityResponse>{
 return prisma.$transaction(async tx=>{
  const shop=await homeOwner(userId,shopId,tx),row=await sourceRow(tx,shop),index=await tx.shopActivityIndex.findUnique({where:{shopId}});
  const base={shopName:shop.name,activityVersion:row.activityVersion,view:input.view};
  if(index&&matches(index,shop,row.activityVersion)){
   const search=input.q?{searchText:{contains:activitySearch(input.q).replace(/[\\%_]/g,'\\$&')}}:{};
   if(input.view==='orders'){
    const where={shopId,...search,...(input.status==='all'?{}:{status:input.status})};
    const page=activityPage(await tx.shopActivityOrder.count({where}),input);
    const rows=await tx.shopActivityOrder.findMany({where,select:orderSelect,orderBy:[{ordinal:'asc'},{orderId:'asc'}],skip:page.offset,take:page.pageSize});
    return {...base,source:'relational',...page,orders:rows.map(activityOrderSummary),customers:[]};
   }
   const where={shopId,...search},page=activityPage(await tx.shopActivityCustomer.count({where}),input);
   const rows=await tx.shopActivityCustomer.findMany({where,select:customerSelect,orderBy:[{ordinal:'asc'},{customerId:'asc'}],skip:page.offset,take:page.pageSize});
   return {...base,source:'relational',...page,orders:[],customers:rows.map(activityCustomerSummary)};
  }
  const current=await sourceRow(tx,shop,true),rows=records(shopId,current.data as unknown as State),q=activitySearch(input.q);
  if(input.view==='orders'){
   const found=rows.orders.filter(o=>(input.status==='all'||o.status===input.status)&&(!q||o.searchText.includes(q))),page=activityPage(found.length,input);
   return {...base,activityVersion:current.activityVersion,source:'compatible',...page,orders:found.slice(page.offset,page.offset+page.pageSize).map(activityOrderSummary),customers:[]};
  }
  const found=rows.customers.filter(c=>!q||c.searchText.includes(q)),page=activityPage(found.length,input);
  return {...base,activityVersion:current.activityVersion,source:'compatible',...page,orders:[],customers:found.slice(page.offset,page.offset+page.pageSize).map(activityCustomerSummary)};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
}
async function storeRows(tx:Prisma.TransactionClient,shopId:string,rows:ReturnType<typeof records>){
 await tx.shopActivityOrder.deleteMany({where:{shopId}});await tx.shopActivityCustomer.deleteMany({where:{shopId}});
 for(let i=0;i<rows.orders.length;i+=1000)await tx.shopActivityOrder.createMany({data:rows.orders.slice(i,i+1000)});
 for(let i=0;i<rows.customers.length;i+=1000)await tx.shopActivityCustomer.createMany({data:rows.customers.slice(i,i+1000)});
}
export async function rebuildActivity(userId:string,shopId:string,force=false){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE "ownerId"=${userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Shop" WHERE id=${shopId} FOR UPDATE`;
  const shop=await homeOwner(userId,shopId,tx);if(!shop.legacyWorkspaceId)await tx.$queryRaw`SELECT "shopId" FROM "ShopCommerce" WHERE "shopId"=${shopId} FOR UPDATE`;
  const row=await sourceRow(tx,shop,true),index=await tx.shopActivityIndex.findUnique({where:{shopId}});
  if(!force&&index&&matches(index,shop,row.activityVersion))return {orders:index.orderCount,customers:index.customerCount,activityVersion:row.activityVersion,unchanged:true};
  const rows=records(shopId,row.data as unknown as State),metadata={...source(shop),sourceVersion:row.activityVersion,orderCount:rows.orders.length,customerCount:rows.customers.length};
  await tx.shopActivityIndex.upsert({where:{shopId},create:{shopId,...metadata},update:metadata});await storeRows(tx,shopId,rows);
  return {orders:rows.orders.length,customers:rows.customers.length,activityVersion:row.activityVersion,unchanged:false};
 },{timeout:60000});
}
/** Counts only: never prints a customer's identity, address or order contents. */
export async function verifyActivity(userId:string,shopId:string){
 return prisma.$transaction(async tx=>{
  const shop=await homeOwner(userId,shopId,tx),row=await sourceRow(tx,shop,true),expected=records(shopId,row.data as unknown as State);
  const index=await tx.shopActivityIndex.findUnique({where:{shopId}});
  const orders=await tx.shopActivityOrder.findMany({where:{shopId},orderBy:[{ordinal:'asc'},{orderId:'asc'}]});
  const customers=await tx.shopActivityCustomer.findMany({where:{shopId},orderBy:[{ordinal:'asc'},{customerId:'asc'}]});
  const compare=(a:unknown[],b:unknown[])=>{let n=0;for(let i=0;i<Math.max(a.length,b.length);i++)if(!isDeepStrictEqual(a[i],b[i]))n++;return n;};
  const mismatchedOrders=compare(orders,expected.orders),mismatchedCustomers=compare(customers,expected.customers);
  const ready=!!index&&matches(index,shop,row.activityVersion);
  return {ready,matches:ready&&mismatchedOrders===0&&mismatchedCustomers===0&&index.orderCount===orders.length&&index.customerCount===customers.length,
   activityVersion:row.activityVersion,expectedOrders:expected.orders.length,indexedOrders:orders.length,expectedCustomers:expected.customers.length,indexedCustomers:customers.length,mismatchedOrders,mismatchedCustomers};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
}
/** Maintain a prepared projection within the source transaction; old writers invalidate it via SQL triggers. */
export async function syncActivity(tx:Prisma.TransactionClient,scope:{shopId:string}|{workspaceId:string;ownerId:string},before:State,after:State,previousVersion:number){
 if(JSON.stringify([before.orders,before.customers])===JSON.stringify([after.orders,after.customers]))return;
 const shop=await tx.shop.findUnique({where:'shopId' in scope?{id:scope.shopId}:{legacyWorkspaceId:scope.workspaceId},select:{id:true,legacyWorkspaceId:true,legacyWorkspace:{select:{ownerId:true}},organization:{select:{ownerId:true}},activityIndex:true}});
 if(!shop?.activityIndex||!matches(shop.activityIndex,shop,previousVersion))return;
 if(shop.legacyWorkspaceId&&shop.legacyWorkspace?.ownerId!==shop.organization.ownerId||'ownerId' in scope&&scope.ownerId!==shop.organization.ownerId)return;
 let rows:ReturnType<typeof records>;try{rows=records(shop.id,after);}catch{await tx.shopActivityIndex.delete({where:{shopId:shop.id}});return;}
 let old:ReturnType<typeof records>;try{old=records(shop.id,before);}catch{await tx.shopActivityIndex.delete({where:{shopId:shop.id}});return;}
 const oldOrders=new Map(old.orders.map(o=>[o.orderId,o])),oldCustomers=new Map(old.customers.map(c=>[c.customerId,c]));
 const changedOrders=rows.orders.filter(o=>!isDeepStrictEqual(oldOrders.get(o.orderId),o)),changedCustomers=rows.customers.filter(c=>!isDeepStrictEqual(oldCustomers.get(c.customerId),c));
 const survivingOrders=new Set(rows.orders.map(o=>o.orderId)),survivingCustomers=new Set(rows.customers.map(c=>c.customerId));
 const orderIds=[...new Set([...old.orders.filter(o=>!survivingOrders.has(o.orderId)).map(o=>o.orderId),...changedOrders.map(o=>o.orderId)])];
 const customerIds=[...new Set([...old.customers.filter(c=>!survivingCustomers.has(c.customerId)).map(c=>c.customerId),...changedCustomers.map(c=>c.customerId)])];
 for(let i=0;i<orderIds.length;i+=1000)await tx.shopActivityOrder.deleteMany({where:{shopId:shop.id,orderId:{in:orderIds.slice(i,i+1000)}}});
 for(let i=0;i<customerIds.length;i+=1000)await tx.shopActivityCustomer.deleteMany({where:{shopId:shop.id,customerId:{in:customerIds.slice(i,i+1000)}}});
 for(let i=0;i<changedOrders.length;i+=1000)await tx.shopActivityOrder.createMany({data:changedOrders.slice(i,i+1000)});
 for(let i=0;i<changedCustomers.length;i+=1000)await tx.shopActivityCustomer.createMany({data:changedCustomers.slice(i,i+1000)});
 const row=await sourceRow(tx,shop);
 await tx.shopActivityIndex.update({where:{shopId:shop.id},data:{sourceVersion:row.activityVersion,orderCount:rows.orders.length,customerCount:rows.customers.length}});
}
