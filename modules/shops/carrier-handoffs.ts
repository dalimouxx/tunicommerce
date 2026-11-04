import {z} from 'zod';
import {HttpError} from '../auth/http';
import type {State} from '../commerce/types';
import {writeIsolatedCommerce} from './aggregate-quotas';

export const carrierHandoffInput=z.object({
 action:z.literal('recordCarrierHandoff'),
 requestId:z.string().uuid(),
 payload:z.object({
  orderId:z.string().uuid(),
  proofReference:z.string().trim().min(6).max(160)
 }).strict()
}).strict();

export const HANDOFF_PAGE_SIZE=40;
export type HandoffPages={pendingPage:number;receiptsPage:number};
/** Strictly bounded parameters. Unknown, repeated and oversized inputs fail closed. */
export function parseHandoffPages(params:URLSearchParams):HandoffPages{
 for(const key of params.keys()){
  if(!['pendingPage','receiptsPage'].includes(key)||params.getAll(key).length!==1)
   throw new HttpError(400,'Paramètres de remise invalides');
 }
 const page=(key:string)=>{
  const raw=params.has(key)?params.get(key)!:'1';
  if(!/^[1-9][0-9]{0,3}$/.test(raw))throw new HttpError(400,'Page de remise invalide');
  return Number(raw);
 };
 return {pendingPage:page('pendingPage'),receiptsPage:page('receiptsPage')};
}
/** Authenticated merchant projection. Buyer PII is never in this report. */
export function carrierHandoffOverview(state:State,pages:HandoffPages={pendingPage:1,receiptsPage:1}){
 const receipts=state.carrierHandoffs||[];
 const receiptByOrder=new Set(receipts.map(receipt=>receipt.orderId));
 const pendingOrders=state.orders.filter(order=>order.status==='SHIPPED'&&!receiptByOrder.has(order.id));
 const pendingCount=pendingOrders.length,totalRecorded=receipts.length;
 const pendingTotalPages=Math.max(1,Math.ceil(pendingCount/HANDOFF_PAGE_SIZE));
 const receiptsTotalPages=Math.max(1,Math.ceil(totalRecorded/HANDOFF_PAGE_SIZE));
 if(!Number.isSafeInteger(pages.pendingPage)||!Number.isSafeInteger(pages.receiptsPage)||
  pages.pendingPage<1||pages.receiptsPage<1||
  pages.pendingPage>pendingTotalPages||pages.receiptsPage>receiptsTotalPages)
  throw new HttpError(400,'Page de registre introuvable');
 const orderReferences=new Map(state.orders.map(order=>[order.id,order.reference]));
 return {
  pending:pendingOrders.slice((pages.pendingPage-1)*HANDOFF_PAGE_SIZE,
   pages.pendingPage*HANDOFF_PAGE_SIZE).map(order=>({
    id:order.id,reference:order.reference,carrier:order.carrier,
    tracking:order.tracking,createdAt:order.createdAt
   })),
  receipts:receipts.slice((pages.receiptsPage-1)*HANDOFF_PAGE_SIZE,
   pages.receiptsPage*HANDOFF_PAGE_SIZE).map(receipt=>({
    id:receipt.id,orderReference:orderReferences.get(receipt.orderId)||'Commande supprimée',
    carrier:receipt.carrier,tracking:receipt.tracking,proofReference:receipt.proofReference,at:receipt.at
   })),
  totalRecorded,pendingCount,pendingPage:pages.pendingPage,receiptsPage:pages.receiptsPage,
  pendingTotalPages,receiptsTotalPages,pageSize:HANDOFF_PAGE_SIZE
 };
}
export async function performCarrierHandoff(ownerId:string,shopId:string,input:z.infer<typeof carrierHandoffInput>){
 return writeIsolatedCommerce(ownerId,shopId,input,()=>{});
}
