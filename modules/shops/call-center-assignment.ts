import {z} from 'zod';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {requireIsolatedOwner} from './isolated-commerce';
import {writeIsolatedCommerce} from './aggregate-quotas';
import type {State} from '../commerce/types';

export const callCenterAssignmentInput=z.object({
 requestId:z.string().uuid(),
 orderId:z.string().uuid(),
 agentId:z.string().uuid().nullable()
}).strict();

export async function assignCallCenterAgent(ownerId:string,shopId:string,
 input:z.infer<typeof callCenterAssignmentInput>){
 await requireIsolatedOwner(ownerId,shopId);
 if(input.agentId!==null){
  const member=await prisma.membership.findUnique({
   where:{shopId_userId:{shopId,userId:input.agentId}},
   select:{active:true,role:true}
  });
  if(!member?.active||!['CALL_CENTER','MANAGER','ADMIN'].includes(member.role))
   throw new HttpError(409,'Agent non autorisé ou inactif dans cette boutique');
 }
 const result=await writeIsolatedCommerce(ownerId,shopId,{
  action:'assignCallAgent',requestId:input.requestId,
  payload:{id:input.orderId,agentId:input.agentId}
 },(before:State,after:State)=>{
  if(before.orders.length!==after.orders.length)throw new HttpError(409,'La liste des commandes a changé');
 });
 const order=result.state.orders.find(o=>o.id===input.orderId);
 return {ok:true,alreadyApplied:result.alreadyApplied,version:result.version,
  assignment:{orderId:input.orderId,agentId:order?.assignedAgentId||null}};
}
