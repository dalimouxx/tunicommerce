import {z} from 'zod';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {writeIsolatedCommerce} from './aggregate-quotas';
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
 
 return writeIsolatedCommerce(userId,shopId,input,enforcePilotOrderCap);
}
