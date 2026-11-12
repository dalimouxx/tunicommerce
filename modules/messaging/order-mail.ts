import {z} from 'zod';
import {labels,type State} from '../commerce/types';

export const orderMailEvents=['ORDER_CREATED','ORDER_STATUS_CHANGED'] as const;
export type OrderMailEvent=typeof orderMailEvents[number];
export const orderMailVariables=['boutique','reference','statut','total','lien','date'] as const;
const allowed=new Set<string>(orderMailVariables);
function validVariables(value:string){
 const clean=value.replace(/\{([a-z]+)\}/g,(match,key:string)=>allowed.has(key)?'':match);
 return !/[{}]/.test(clean);
}
const subject=z.string().trim().min(1).max(160).refine(v=>!/[\r\n\u0000-\u001f\u007f]/.test(v),'Objet invalide')
 .refine(validVariables,'Variable de modèle inconnue');
const body=z.string().trim().min(1).max(4000).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),'Texte invalide')
 .refine(validVariables,'Variable de modèle inconnue');
export const orderMailTemplate=z.object({subject,body}).strict();
export const orderMailTemplates=z.object({ORDER_CREATED:orderMailTemplate,ORDER_STATUS_CHANGED:orderMailTemplate}).strict();
export type OrderMailTemplates=z.infer<typeof orderMailTemplates>;
export const defaultOrderMailTemplates:OrderMailTemplates={
 ORDER_CREATED:{subject:'{boutique} · Nouvelle commande {reference}',body:'Une nouvelle commande est enregistrée.\n\nRéférence : {reference}\nÉtat : {statut}\nTotal : {total}\nÉvénement : {date}\n\nConsultez votre espace privé : {lien}'},
 ORDER_STATUS_CHANGED:{subject:'{boutique} · {reference} : {statut}',body:'Le statut de la commande a changé.\n\nRéférence : {reference}\nÉtat à cette date : {statut}\nTotal : {total}\nÉvénement : {date}\n\nConsultez votre espace privé : {lien}'}
};
export const changeOrderMail=z.object({enabled:z.boolean(),templates:orderMailTemplates,expectedVersion:z.number().int().nonnegative()}).strict();
/** No customer names, addresses, phone numbers, notes, costs or tracking bearer token. */
export function orderMailChanges(before:State,after:State){
 const previous=new Map(before.orders.map(order=>[order.id,order.status]));
 return after.orders.flatMap(order=>{
  const old=previous.get(order.id);
  const event:OrderMailEvent|undefined=old===undefined?'ORDER_CREATED':old!==order.status?'ORDER_STATUS_CHANGED':undefined;
  return event?[{event,orderId:order.id,reference:order.reference,status:order.status,total:order.total}]:[];
 });
}
export function renderOrderMail(template:z.infer<typeof orderMailTemplate>,input:{shopName:string;reference:string;status:keyof typeof labels;total:number;url:string;at:string}){
 const safeLine=(s:string)=>s.replace(/[\r\n\u0000-\u001f\u007f]/g,' ').slice(0,180);
 const values:Record<string,string>={boutique:safeLine(input.shopName),reference:safeLine(input.reference),
  statut:labels[input.status],total:(input.total/1000).toFixed(3)+' TND',lien:input.url,date:input.at};
 const render=(text:string)=>text.replace(/\{([a-z]+)\}/g,(_match,key:string)=>values[key]??'');
 return {subject:render(template.subject).slice(0,998),text:render(template.body).slice(0,12000)};
}
export const orderMailPayload=z.object({shopId:z.string().min(1).max(180),ownerId:z.string().min(1).max(180),email:z.email(),
 at:z.iso.datetime(),subject:z.string().max(998).refine(v=>!/[\r\n]/.test(v)),text:z.string().max(12000)}).strict();
