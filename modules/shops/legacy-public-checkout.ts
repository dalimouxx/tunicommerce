import {randomBytes} from 'node:crypto';
import {enqueueOrderMail} from '../messaging/order-mail-service';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../storage/client';
import {isOpen} from '../platform/public';
import {normalizeState} from '../commerce/normalize';
import {applyAction} from '../commerce/service';
import type {State} from '../commerce/types';
import {HttpError} from '../auth/http';
import {loadWorkspaceQuotas} from '../subscriptions/quotas';
import {assertMerchantAggregateQuotas} from './aggregate-quotas';

/** Keep legacy public checkout request contract unchanged. */
export const legacyPublicCheckoutInput=z.object({
 requestId:z.string().uuid(),
 customer:z.object({
  name:z.string().trim().min(2).max(100),
  phone:z.string().max(12),city:z.string().max(40),
  address:z.string().trim().min(3).max(300)
 }),
 items:z.array(z.object({
  productId:z.string().max(100),quantity:z.number().int().min(1).max(100)
 })).min(1).max(100)
});
export type LegacyPublicCheckoutInput=z.infer<typeof legacyPublicCheckoutInput>;

/**
 * Legacy public checkout must participate in exactly the same owner-wide lock
 * as modern ShopCommerce and the authenticated Workspace mutations.
 * The additional row lock keeps older CAS-based Workspace writes compatible.
 */
export async function createLegacyPublicOrder(slug:string,input:LegacyPublicCheckoutInput){
 const candidate=await prisma.workspace.findUnique({where:{slug},select:{id:true,ownerId:true}});
 if(!candidate)throw new HttpError(404,'Boutique introuvable');
 const receipt=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${candidate.ownerId}))`;
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${candidate.id} FOR UPDATE`;
  const row=await tx.workspace.findUniqueOrThrow({where:{id:candidate.id}});
  if(row.ownerId!==candidate.ownerId)throw new HttpError(404,'Boutique introuvable');
  if(!isOpen(row))throw new HttpError(403,'Cette boutique ne prend pas de commandes actuellement.');
  const previous=await tx.publicReceipt.findUnique({
   where:{workspaceId_requestId:{workspaceId:row.id,requestId:input.requestId}},
   select:{id:true,reference:true,total:true}
  });
  if(previous)return previous;
  const before=normalizeState(row.data as unknown as State);
  let next:State;
  try{next=applyAction(before,'createOrder',{
   ...input.customer,items:input.items,source:'Boutique'
  });}
  catch(error){throw new HttpError(400,error instanceof Error?error.message:'Commande invalide');}
  const [quotas,otherRows]=await Promise.all([
   loadWorkspaceQuotas(row,tx),
   tx.shopCommerce.findMany({
    where:{shop:{organization:{ownerId:candidate.ownerId}}},
    select:{data:true}
   })
  ]);
  assertMerchantAggregateQuotas(
   otherRows.map(other=>normalizeState(other.data as unknown as State)),
   before,next,quotas
  );
  const receiptId=randomBytes(32).toString('hex');
  next.orders[0].publicReceiptId=receiptId;
  await tx.workspace.update({
   where:{id:row.id},
   data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}
  });
  await enqueueOrderMail(tx,{workspaceId:row.id,ownerId:row.ownerId},before,next,row.version+1);
  return tx.publicReceipt.create({data:{
   id:receiptId,workspaceId:row.id,requestId:input.requestId,
   reference:next.orders[0].reference,total:next.orders[0].total
  },select:{id:true,reference:true,total:true}});
 },{timeout:15000});
 return {
  reference:receipt.reference,total:receipt.total,
  trackingUrl:/^[a-f0-9]{64}$/.test(receipt.id)?'/suivi/'+receipt.id:null
 };
}
