import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {normalizeState} from '../commerce/normalize';
import {applyAction} from '../commerce/service';
import type {State} from '../commerce/types';
import {assertCommerceQuotas,quotasForOwner,type EnforcedQuotas} from '../subscriptions/quotas';
import {requireIsolatedOwner} from './isolated-commerce';
import {canAccessShop,type ShopPermission} from './permissions';

export function tunisianMonth(value:Date|string):string{
 const date=typeof value==='string'?new Date(value):value;
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Tunis',year:'numeric',month:'2-digit'}).format(date);
}
export function merchantUsage(states:readonly State[],now=new Date()){
 const month=tunisianMonth(now);
 return {
  products:states.reduce((sum,state)=>sum+state.products.length,0),
  ordersThisMonth:states.reduce((sum,state)=>sum+state.orders.filter(order=>tunisianMonth(order.createdAt)===month).length,0)
 };
}
/** Count all owned shop data plus the owner's legacy Workspace once, including the new state under evaluation. */
export function assertMerchantAggregateQuotas(
 otherStates:readonly State[],previous:State,next:State,quotas:EnforcedQuotas,now=new Date()
){
 // Existing limits on the individual commerce state are retained.
 assertCommerceQuotas(previous,next,quotas,now);
 const usage=merchantUsage([...otherStates,next],now);
 if(next.products.length>previous.products.length&&quotas.maxProducts!==null&&usage.products>quotas.maxProducts)
  throw new HttpError(409,`Plafond global atteint : ${usage.products}/${quotas.maxProducts} produits, toutes boutiques confondues.`);
 if(next.orders.length>previous.orders.length&&quotas.maxOrdersPerMonth!==null&&usage.ordersThisMonth>quotas.maxOrdersPerMonth)
  throw new HttpError(409,`Plafond global atteint : ${usage.ordersThisMonth}/${quotas.maxOrdersPerMonth} commandes ce mois-ci, toutes boutiques confondues.`);
}

type Mutation={action:string;payload?:unknown;requestId:string};
/**
 * A per-owner transaction advisory lock serializes writes to all NEW ShopCommerce records
 * initiated by this service. Legacy Workspace writes use their existing code path and are
 * not serialized by this lock; this remaining integration must be solved before launch.
 */
export async function writeIsolatedCommerce(
 userId:string,shopId:string,input:Mutation,
 check:(before:State,after:State)=>void,
 permission?:ShopPermission
){
 if(!permission)await requireIsolatedOwner(userId,shopId);
 // Employees use the organization's billing owner; no private billing access is granted to them.
 const shop=permission?await prisma.shop.findUnique({where:{id:shopId},select:{organization:{select:{ownerId:true}}}}):null;
 if(permission&&!shop)throw new HttpError(404,'Boutique introuvable');
 const billingOwnerId=permission?shop!.organization.ownerId:userId;
 const quotas=await quotasForOwner(billingOwnerId);
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${billingOwnerId}))`;
  const membership=await tx.membership.findUnique({
   where:{shopId_userId:{shopId,userId}},
   select:{active:true,role:true,shop:{select:{legacyWorkspaceId:true}}}
  });
  if(!membership?.active||membership.shop.legacyWorkspaceId!==null||
   (permission?!canAccessShop(membership.role,permission):membership.role!=='OWNER'))
   throw new HttpError(403,'Accès à cette boutique interdit');
  const row=await tx.shopCommerce.findUnique({where:{shopId},select:{data:true,version:true}});
  if(!row)throw new HttpError(409,'Initialisez votre boutique avant toute opération.');
  const before=normalizeState(row.data as unknown as State);
  if(before.requests.includes(input.requestId))
   return {state:before,version:row.version,alreadyApplied:true};
  let next:State;
  try{next=applyAction(before,input.action,input.payload);}
  catch(error){
   if(error instanceof z.ZodError)throw new HttpError(400,error.issues[0]?.message||'Données invalides');
   throw new HttpError(400,error instanceof Error?error.message:'Opération invalide');
  }
  check(before,next);
  if(permission)next.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),label:'Équipe '+userId+' ('+membership.role+') · '+input.action});
  const [legacy,otherShopRows]=await Promise.all([
   tx.workspace.findUnique({where:{ownerId:billingOwnerId},select:{data:true}}),
   tx.shopCommerce.findMany({
    where:{shopId:{not:shopId},shop:{organization:{ownerId:billingOwnerId}}},
    select:{data:true}
   })
  ]);
  // No duplicate legacy record: isolated rows are always independent of Workspace.
  const others:State[]=[
   ...(legacy?[normalizeState(legacy.data as unknown as State)]:[]),
   ...otherShopRows.map(other=>normalizeState(other.data as unknown as State))
  ];
  assertMerchantAggregateQuotas(others,before,next,quotas);
  next.requests=[...before.requests.slice(-999),input.requestId];
  const updated=await tx.shopCommerce.updateMany({
   where:{shopId,version:row.version},
   data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}
  });
  if(updated.count!==1)throw new HttpError(409,'Modification concurrente. Actualisez puis réessayez.');
  return {state:next,version:row.version+1,alreadyApplied:false};
 },{timeout:15000});
}
