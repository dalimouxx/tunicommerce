import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {requireShopMembership} from '../shops/access';
import {canAccessShop} from '../shops/permissions';
import {deliveryOutcomes,phoneKey,reliabilityCounts} from './policy';

type Tx=Prisma.TransactionClient;
const tokenPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keyed=(state:State)=>deliveryOutcomes(state).flatMap(row=>{const key=phoneKey(row.phone);return key?[{...row,phoneKey:key}]:[];});

/** Reconciles one shop's finished orders with the shared table. Contest fields are preserved. */
export async function syncReliability(tx:Tx,shopId:string,state:State){
 const rows=keyed(state);
 const existing=await tx.customerDeliveryOutcome.findMany({where:{shopId},select:{id:true,orderId:true,outcome:true,phoneKey:true,occurredAt:true}});
 const byOrder=new Map(existing.map(row=>[row.orderId,row])),keep=new Set(rows.map(row=>row.orderId));
 const created=rows.filter(row=>!byOrder.has(row.orderId));
 if(created.length)await tx.customerDeliveryOutcome.createMany({data:created.map(row=>({shopId,orderId:row.orderId,phoneKey:row.phoneKey,outcome:row.outcome,occurredAt:new Date(row.occurredAt)})),skipDuplicates:true});
 for(const row of rows){
  const old=byOrder.get(row.orderId);
  if(!old||old.outcome===row.outcome&&old.phoneKey===row.phoneKey&&old.occurredAt.getTime()===Date.parse(row.occurredAt))continue;
  await tx.customerDeliveryOutcome.update({where:{id:old.id},data:{phoneKey:row.phoneKey,outcome:row.outcome,occurredAt:new Date(row.occurredAt),
   ...(old.outcome!==row.outcome?{contestStatus:null,contestReason:null,contestedAt:null,decidedAt:null,decidedBy:null}:{})}});
 }
 const gone=existing.filter(row=>!keep.has(row.orderId)).map(row=>row.id);
 if(gone.length)await tx.customerDeliveryOutcome.deleteMany({where:{id:{in:gone}}});
}
/** Called inside merchant write transactions; does nothing unless finished orders changed. */
export async function syncReliabilityOnWrite(tx:Tx,scope:{shopId:string}|{workspaceId:string},before:State,after:State){
 if(JSON.stringify(deliveryOutcomes(before))===JSON.stringify(deliveryOutcomes(after)))return;
 const shopId='shopId' in scope?scope.shopId:(await tx.shop.findUnique({where:{legacyWorkspaceId:scope.workspaceId},select:{id:true}}))?.id;
 if(shopId)await syncReliability(tx,shopId,after);
}
/** Full idempotent rebuild (backfill and writes outside the main paths). */
export async function rebuildReliability(){
 const shops=await prisma.shop.findMany({select:{id:true,legacyWorkspaceId:true}});
 let outcomes=0;
 for(const shop of shops){
  const source=shop.legacyWorkspaceId?await prisma.workspace.findUnique({where:{id:shop.legacyWorkspaceId},select:{data:true}}):await prisma.shopCommerce.findUnique({where:{shopId:shop.id},select:{data:true}});
  if(!source)continue;
  const state=normalizeState(source.data as unknown as State);
  await prisma.$transaction(tx=>syncReliability(tx,shop.id,state),{timeout:60000});
  outcomes+=keyed(state).length;
 }
 return {shops:shops.length,outcomes};
}
async function countsFor(keys:string[]){
 if(!keys.length)return new Map<string,{delivered:number;refused:number}>();
 const rows=await prisma.customerDeliveryOutcome.findMany({where:{phoneKey:{in:keys}},select:{phoneKey:true,outcome:true,contestStatus:true}});
 return new Map(keys.map(key=>[key,reliabilityCounts(rows.filter(row=>row.phoneKey===key))]));
}
/** Counts for the phones of the merchant's OWN orders only; a merchant cannot query an arbitrary number. */
export async function reliabilityForOrders(userId:string,shopId:string,orderIds:readonly string[]){
 const membership=await requireShopMembership(userId,shopId);
 if(!canAccessShop(membership.role,'orders.read'))throw new HttpError(403,'Accès boutique interdit');
 const shop=await prisma.shop.findUnique({where:{id:shopId},select:{legacyWorkspaceId:true,commerce:{select:{data:true}},legacyWorkspace:{select:{data:true}}}});
 const data=shop?.legacyWorkspaceId?shop.legacyWorkspace?.data:shop?.commerce?.data;
 if(!data)return {};
 const state=normalizeState(data as unknown as State),wanted=new Set(orderIds.slice(0,200));
 const customers=new Map(state.customers.map(customer=>[customer.id,customer]));
 const keys=new Map<string,string>();
 for(const order of state.orders)if(wanted.has(order.id)){const key=phoneKey((order.customerSnapshot||customers.get(order.customerId))?.phone||'');if(key)keys.set(order.id,key);}
 const counts=await countsFor([...new Set(keys.values())]);
 return Object.fromEntries([...keys].map(([orderId,key])=>[orderId,counts.get(key)!])) as Record<string,{delivered:number;refused:number}>;
}
/** Customer contest from the private tracking link of an isolated shop's refused order. */
export async function contestRefusal(slug:string,token:string,reason:string){
 if(!tokenPattern.test(token)||slug.length>180)throw new HttpError(404,'Commande introuvable');
 const shop=await prisma.shop.findUnique({where:{slug},select:{id:true,legacyWorkspaceId:true,commerce:{select:{data:true}}}});
 if(!shop||shop.legacyWorkspaceId||!shop.commerce)throw new HttpError(404,'Commande introuvable');
 const order=normalizeState(shop.commerce.data as unknown as State).orders.find(item=>item.publicReceiptId===token);
 if(!order)throw new HttpError(404,'Commande introuvable');
 const updated=await prisma.customerDeliveryOutcome.updateMany({where:{shopId:shop.id,orderId:order.id,outcome:'REFUSED',contestStatus:null},
  data:{contestStatus:'PENDING',contestReason:reason.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,500),contestedAt:new Date()}});
 if(!updated.count)throw new HttpError(409,'Aucun refus contestable pour cette commande.');
 return {status:'PENDING' as const};
}
export async function pendingContests(){
 const rows=await prisma.customerDeliveryOutcome.findMany({where:{contestStatus:'PENDING'},orderBy:{contestedAt:'asc'},take:200,
  select:{id:true,orderId:true,occurredAt:true,contestReason:true,contestedAt:true,shop:{select:{name:true,commerce:{select:{data:true}},legacyWorkspace:{select:{data:true}}}}}});
 return rows.map(row=>{
  const data=row.shop.commerce?.data||row.shop.legacyWorkspace?.data;
  const order=data?normalizeState(data as unknown as State).orders.find(item=>item.id===row.orderId):undefined;
  return {id:row.id,shopName:row.shop.name,reference:order?.reference||row.orderId,carrier:order?.carrier||'',tracking:order?.tracking||'',
   refusedAt:row.occurredAt,reason:row.contestReason||'',contestedAt:row.contestedAt,events:(order?.events||[]).slice(-6)};
 });
}
/** ACCEPTED: the refusal is withdrawn for good. REJECTED: the refusal counts again. Journaled. */
export async function decideContest(adminId:string,input:{id:string;decision:'ACCEPTED'|'REJECTED'}){
 return prisma.$transaction(async tx=>{
  const row=await tx.customerDeliveryOutcome.findUnique({where:{id:input.id},select:{id:true,orderId:true,shop:{select:{name:true,legacyWorkspaceId:true,organization:{select:{owner:{select:{workspace:{select:{id:true}}}}}}}}}});
  if(!row)throw new HttpError(404,'Contestation introuvable');
  const updated=await tx.customerDeliveryOutcome.updateMany({where:{id:row.id,contestStatus:'PENDING'},data:{contestStatus:input.decision,decidedAt:new Date(),decidedBy:adminId}});
  if(!updated.count)throw new HttpError(409,'Cette contestation a déjà été tranchée.');
  await tx.platformAudit.create({data:{actorId:adminId,workspaceId:row.shop.legacyWorkspaceId||row.shop.organization.owner.workspace?.id||'',
   detail:'Contestation de refus '+(input.decision==='ACCEPTED'?'acceptée (refus retiré)':'rejetée (refus confirmé)')+' · '+row.shop.name+' · '+row.id}});
  return {status:input.decision};
 });
}
