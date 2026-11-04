import {z} from 'zod';
import {governors} from '../commerce/types';
import {writeIsolatedCommerce} from './aggregate-quotas';

export const carrierConfigurationInput=z.object({
 action:z.literal('saveCarrier'),
 requestId:z.string().uuid(),
 payload:z.object({
  id:z.string().uuid().optional(),
  name:z.string().trim().min(1).max(120),
  phone:z.string().trim().max(30),
  governorates:z.array(z.enum(governors as [string,...string[]])).min(1).max(24)
   .refine(x=>new Set(x).size===x.length,'Gouvernorat dupliqué'),
  deliveryCost:z.number().int().min(0).max(10_000_000),
  returnCost:z.number().int().min(0).max(10_000_000),
  active:z.boolean()
 }).strict()
}).strict();

export async function saveIsolatedCarrier(ownerId:string,shopId:string,
 input:z.infer<typeof carrierConfigurationInput>){
 return writeIsolatedCommerce(ownerId,shopId,input,()=>{});
}
