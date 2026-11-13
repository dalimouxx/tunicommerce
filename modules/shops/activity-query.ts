import {z} from 'zod';
import {catalogSearch} from './catalog-query';
import {labels} from '../commerce/types';
export const activityStatuses=['TO_CONFIRM','NO_ANSWER','CALLBACK','CONFIRMED','PREPARING','READY','SHIPPED','DELIVERED','CANCELLED','RETURNED'] as const;
export const activityQuery=z.object({view:z.enum(['orders','customers']).default('orders'),q:z.string().trim().max(100).default(''),
 status:z.enum(['all',...activityStatuses]).default('all'),page:z.coerce.number().int().min(1).max(1_000_000).default(1),
 pageSize:z.coerce.number().int().min(1).max(100).default(40)}).strict().refine(q=>q.view==='orders'||q.status==='all',{message:'Le statut concerne uniquement les commandes.'});
export type ActivityQuery=z.infer<typeof activityQuery>;
export {labels};
export function activityPage(total:number,input:ActivityQuery){const pages=Math.max(1,Math.ceil(total/input.pageSize)),page=Math.min(input.page,pages);return {total,pages,page,pageSize:input.pageSize,offset:(page-1)*input.pageSize};}
export const activitySearch=catalogSearch;
const exact=z.number().int().nonnegative();
export const orderSummary=z.object({id:z.string(),reference:z.string(),status:z.enum(activityStatuses),source:z.string(),total:exact,collected:exact,createdAt:z.string(),customerName:z.string(),customerPhone:z.string(),customerCity:z.string()}).strict();
export const customerSummary=z.object({id:z.string(),name:z.string(),phone:z.string(),city:z.string(),orderCount:exact,deliveredCount:exact,deliveredGross:exact}).strict();
export const activityResponse=z.object({shopName:z.string(),source:z.enum(['relational','compatible']),activityVersion:exact,total:exact,pages:exact,page:exact,pageSize:exact,offset:exact,
 view:z.enum(['orders','customers']),orders:z.array(orderSummary).max(100),customers:z.array(customerSummary).max(100)}).strict();
export type ActivityResponse=z.infer<typeof activityResponse>;
