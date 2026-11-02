import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {applyAction} from '../commerce/service';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {assertCommerceQuotas,quotasForOwner} from '../subscriptions/quotas';
import {requireIsolatedOwner} from './isolated-commerce';

export const PILOT_MAX_ORDERS=10;
export const orderMutation=z.object({
 action:z.enum(['createOrder','transition','note']),
 payload:z.unknown(),
 requestId:z.string().uuid()
}).strict();

function tunisMonth(at:Date){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Tunis',year:'numeric',month:'2-digit'}).format(at);
}
export function enforcePilotOrderCap(before:State,after:State,now=new Date()){
 if(after.orders.length<=before.orders.length)return;
 const period=tunisMonth(now);
 const count=after.orders.filter(o=>tunisMonth(new Date(o.createdAt))===period).length;
 if(count>PILOT_MAX_ORDERS)throw new HttpError(409,'Pilote limité à '+PILOT_MAX_ORDERS+' commandes par mois et par boutique.');
}
export async function performShopOrderAction(userId:string,shopId:string,input:z.infer<typeof orderMutation>){
 await requireIsolatedOwner(userId,shopId);
 // No subscription bypass: the existing owner quota must be resolvable.
 const quotas=await quotasForOwner(userId);
 for(let attempt=0;attempt<4;attempt++){
  await requireIsolatedOwner(userId,shopId);
  const row=await prisma.shopCommerce.findUnique({where:{shopId},select:{data:true,version:true}});
  if(!row)throw new HttpError(409,'Initialisez la boutique avant de créer des commandes.');
  const before=normalizeState(row.data as unknown as State);
  if(before.requests.includes(input.requestId))return {state:before,version:row.version,alreadyApplied:true};
  let next:State;
  try{next=applyAction(before,input.action,input.payload);}
  catch(e){
   if(e instanceof z.ZodError)throw new HttpError(400,e.issues[0]?.message||'Commande invalide');
   throw new HttpError(400,e instanceof Error?e.message:'Action de commande invalide');
  }
  enforcePilotOrderCap(before,next);
  assertCommerceQuotas(before,next,quotas);
  next.requests=[...before.requests.slice(-999),input.requestId];
  const saved=await prisma.shopCommerce.updateMany({
   where:{shopId,version:row.version},
   data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}
  });
  if(saved.count===1)return {state:next,version:row.version+1,alreadyApplied:false};
 }
 throw new HttpError(409,'Conflit de modification : rechargez les commandes.');
}
