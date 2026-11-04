import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {consumeAttempt} from '../auth/service';
import {normalizeState} from '../commerce/normalize';
import {canRequest} from '../platform/tracking';
import type {State} from '../commerce/types';

export const privateTrackingTokenPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isolatedCustomerRequestInput=z.object({
 id:z.string().uuid(),
 type:z.enum(['CANCEL','RETURN']),
 reason:z.string().trim().min(5).max(500)
}).strict();
export type IsolatedCustomerRequestInput=z.infer<typeof isolatedCustomerRequestInput>;

/** Pure per-order mutation: no merchant identity, delivery or payment status is changed. */
export function appendCustomerRequest(
 original:State,token:string,input:IsolatedCustomerRequestInput,now=new Date()
){
 const next=normalizeState(structuredClone(original));
 const order=next.orders.find(row=>row.publicReceiptId===token);
 if(!order)throw new HttpError(404,'Commande introuvable');
 order.customerRequests??=[];
 const previous=order.customerRequests.find(row=>row.id===input.id);
 if(previous){
  if(previous.type!==input.type||previous.reason!==input.reason)
   throw new HttpError(409,'Identifiant de demande déjà utilisé');
  return {state:next,alreadyApplied:true};
 }
 if(!canRequest(order,input.type))throw new HttpError(409,'Demande impossible à ce stade');
 if(order.customerRequests.some(row=>row.status==='PENDING'))
  throw new HttpError(409,'Une demande est déjà en attente');
 if(order.customerRequests.length>=5)throw new HttpError(409,'Contactez directement le marchand');
 const at=now.toISOString();
 order.customerRequests.push({...input,at,status:'PENDING'});
 order.events.push({at,label:'Demande client : '+(input.type==='CANCEL'?'annulation':'retour')});
 next.audit.unshift({id:crypto.randomUUID(),at,label:'Demande client · '+order.reference});
 return {state:next,alreadyApplied:false};
}

/** Public bearer-token request. Owner-level lock prevents lost updates against
 * merchant writes, checkout, fulfillment and COD settlement transactions.
 */
export async function submitIsolatedCustomerRequest(
 slug:string,token:string,input:IsolatedCustomerRequestInput
){
 if(!slug||slug.length>180||!privateTrackingTokenPattern.test(token))
  throw new HttpError(404,'Lien de suivi introuvable');
 const shop=await prisma.shop.findUnique({where:{slug},select:{
  id:true,legacyWorkspaceId:true,organization:{select:{ownerId:true}}
 }});
 if(!shop||shop.legacyWorkspaceId!==null)throw new HttpError(404,'Lien de suivi introuvable');
 const ownerId=shop.organization.ownerId;
 const key='isolated-request:'+createHash('sha256').update(shop.id+':'+token).digest('hex');
 await consumeAttempt(key,30);
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${ownerId}))`;
  const current=await tx.shop.findUnique({where:{id:shop.id},select:{
   legacyWorkspaceId:true,organization:{select:{ownerId:true}},
   commerce:{select:{data:true,version:true}}
  }});
  if(!current||current.legacyWorkspaceId!==null||
   current.organization.ownerId!==ownerId||!current.commerce)
   throw new HttpError(404,'Lien de suivi introuvable');
  const row=current.commerce;
  const change=appendCustomerRequest(normalizeState(row.data as unknown as State),token,input);
  if(change.alreadyApplied)return {accepted:true,alreadyApplied:true};
  const saved=await tx.shopCommerce.updateMany({where:{shopId:shop.id,version:row.version},
   data:{data:change.state as unknown as Prisma.InputJsonValue,version:{increment:1}}});
  if(saved.count!==1)throw new HttpError(409,'Modification concurrente, réessayez');
  return {accepted:true,alreadyApplied:false};
 },{timeout:15000});
}
