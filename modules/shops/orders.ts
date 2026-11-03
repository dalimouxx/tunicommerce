import {z} from 'zod';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {writeIsolatedCommerce} from './aggregate-quotas';
import {applyAction} from '../commerce/service';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {assertCommerceQuotas,quotasForOwner} from '../subscriptions/quotas';
import {requireIsolatedOwner} from './isolated-commerce';

export const orderMutation=z.object({
 action:z.enum(['createOrder','transition','note']),
 payload:z.unknown(),
 requestId:z.string().uuid()
}).strict();

export async function performShopOrderAction(userId:string,shopId:string,input:z.infer<typeof orderMutation>){
 
 return writeIsolatedCommerce(userId,shopId,input,()=>{});
}
