import {z} from 'zod';
import type {Order,State} from '../commerce/types';

/** Customer self-confirmation of a cash-on-delivery order, through a private link sent to the order's phone. */
export const CONFIRMATION_TTL_MS=7*24*3600_000;
export const confirmablePendingStatuses=['TO_CONFIRM','NO_ANSWER','CALLBACK'] as const;
export const confirmationTokenPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const issueConfirmationPayload=z.object({orderId:z.string().min(1).max(160)}).strict();
export const customerConfirmationPayload=z.object({
 token:z.string().regex(confirmationTokenPattern,'Lien de confirmation introuvable'),
 answer:z.enum(['CONFIRMED','CHANGE','CANCELLED']),
 note:z.string().trim().max(500,'Message trop long (500 caractères maximum)').optional()
}).strict().superRefine((value,ctx)=>{
 if(value.answer==='CHANGE'&&(value.note||'').length<5)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Indiquez ce que vous souhaitez modifier',path:['note']});
});
export const publicConfirmationInput=z.object({
 requestId:z.string().uuid(),answer:z.enum(['CONFIRMED','CHANGE','CANCELLED']),
 note:z.string().trim().max(500,'Message trop long (500 caractères maximum)').optional()
}).strict();
export type ConfirmationAnswer='CONFIRMED'|'CHANGE'|'CANCELLED';
export const isPendingConfirmation=(status:string)=>(confirmablePendingStatuses as readonly string[]).includes(status);

/** What the customer sees: order content for verification, never costs or internal notes. */
export function confirmationView(state:State,token:string,now:Date){
 if(!confirmationTokenPattern.test(token))return null;
 const order=state.orders.find(item=>item.confirmation?.token===token);
 if(!order)return null;
 const customer=order.customerSnapshot||state.customers.find(item=>item.id===order.customerId);
 const confirmation=order.confirmation!;
 const expired=Date.parse(confirmation.expiresAt)<=now.getTime();
 return {
  reference:order.reference,status:order.status,
  items:order.items.map(item=>({name:item.name,variant:item.variant,quantity:item.quantity,price:item.price})),
  subtotal:order.subtotal,discount:order.discount,shipping:order.shipping,total:order.total,
  customer:{name:customer?.name||'',city:customer?.city||'',address:customer?.address||''},
  answer:confirmation.answer||null,answeredAt:confirmation.answeredAt||null,expired,
  canAnswer:!confirmation.answer&&!expired&&isPendingConfirmation(order.status)
 };
}
const money=(millimes:number)=>(millimes/1000).toFixed(3)+' TND';
/** WhatsApp text prepared for the merchant; the customer answers by opening the link. */
export function confirmationMessage(order:Pick<Order,'reference'|'items'|'total'>,link:string,merchantName:string){
 const store=merchantName.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,70)||'Votre boutique';
 const lines=order.items.slice(0,8).map(item=>'• '+item.quantity+' × '+item.name+(item.variant?' ('+item.variant+')':''));
 return [store+' — commande '+order.reference,...lines,'Total à payer à la livraison : '+money(order.total),'',
  'Merci de confirmer votre commande en un clic (ou de demander une modification) :',link,'',
  'تأكيد طلبك بنقرة واحدة عبر الرابط أعلاه.'].join('\n');
}
/** Call-center label: what the customer did with the link (never a claim that a message was delivered). */
export function confirmationBadge(order:{confirmation?:{expiresAt:string;answer?:ConfirmationAnswer;note?:string}},now:Date){
 const c=order.confirmation;
 if(!c)return null;
 if(c.answer==='CONFIRMED')return 'Confirmée par le client';
 if(c.answer==='CANCELLED')return 'Annulée par le client';
 if(c.answer==='CHANGE')return 'Modification demandée : '+(c.note||'');
 return Date.parse(c.expiresAt)<=now.getTime()?'Lien expiré · à relancer':'Lien envoyé · en attente du client';
}
