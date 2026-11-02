import {z} from 'zod';
import {HttpError} from '../auth/http';
import {writeIsolatedCommerce} from './aggregate-quotas';
import {type ShopPermission} from './permissions';
import {enforcePilotOrderCap} from './orders';
import type {State,Status} from '../commerce/types';

const id=z.string().uuid();
const stockPayload=z.object({
 id,quantity:z.number().int().min(-100000).max(100000).refine(x=>x!==0),
 reason:z.string().trim().min(3).max(160)
}).strict();
const callTransitionPayload=z.object({
 id,status:z.enum(['CONFIRMED','NO_ANSWER','CALLBACK']),
 callbackAt:z.string().optional()
}).strict();
const callNotePayload=z.object({
 id,note:z.string().trim().min(3).max(160)
}).strict();
export const teamWriteInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('adjustStock'),requestId:id,payload:stockPayload}).strict(),
 z.object({action:z.literal('confirmOrder'),requestId:id,payload:callTransitionPayload}).strict(),
 z.object({action:z.literal('callNote'),requestId:id,payload:callNotePayload}).strict()
]);
export type TeamWriteInput=z.infer<typeof teamWriteInput>;

export function requiredTeamPermission(action:TeamWriteInput['action']):ShopPermission{
 return action==='adjustStock'?'stock.adjust':'orders.update';
}
export function validateCallTransition(previous:State,input:Extract<TeamWriteInput,{action:'confirmOrder'}>){
 const order=previous.orders.find(o=>o.id===input.payload.id);
 if(!order)throw new HttpError(404,'Commande introuvable');
 const permittedStatuses:readonly Status[]=['TO_CONFIRM','NO_ANSWER','CALLBACK'];
 if(!permittedStatuses.includes(order.status))
  throw new HttpError(403,'Cette commande ne peut pas être modifiée par le Call Center');
 if(input.payload.status==='CALLBACK'&&(!input.payload.callbackAt||
   !Number.isFinite(Date.parse(input.payload.callbackAt))||
   Date.parse(input.payload.callbackAt)<=Date.now()))
  throw new HttpError(400,'Rappel futur requis');
 if(input.payload.status!=='CALLBACK'&&input.payload.callbackAt)
  throw new HttpError(400,'Date de rappel non autorisée pour ce statut');
}
export function validateCallNote(previous:State,input:Extract<TeamWriteInput,{action:'callNote'}>){
 const order=previous.orders.find(o=>o.id===input.payload.id);
 if(!order)throw new HttpError(404,'Commande introuvable');
 if(!['TO_CONFIRM','NO_ANSWER','CALLBACK'].includes(order.status))
  throw new HttpError(403,'Seules les commandes en confirmation peuvent être annotées');
}
export async function performTeamAction(actorId:string,shopId:string,input:TeamWriteInput){
 const permission=requiredTeamPermission(input.action);
 const mutationAction=input.action==='adjustStock'?'stock':input.action==='confirmOrder'?'transition':'note';
 const check=(before:State,after:State)=>{
  if(input.action==='confirmOrder')validateCallTransition(before,input);
  if(input.action==='callNote')validateCallNote(before,input);
  if(input.action==='adjustStock'&&before.products.length!==after.products.length)
   throw new HttpError(409,'Modification de catalogue interdite');
  enforcePilotOrderCap(before,after);
 };
 return writeIsolatedCommerce(actorId,shopId,{
  action:mutationAction,payload:input.payload,requestId:input.requestId
 },check,permission);
}
