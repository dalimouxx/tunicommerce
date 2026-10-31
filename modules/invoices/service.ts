import {z} from 'zod';
import type {State} from '../commerce/types';
export function applyInvoice(s:State,action:string,payload:unknown){const now=new Date().toISOString();
 if(action==='createInvoice'){
 const {orderId}=z.object({orderId:z.string()}).parse(payload);const o=s.orders.find(o=>o.id===orderId);if(!o||o.status==='CANCELLED'||o.status==='RETURNED')throw Error('Commande non facturable');if(s.invoices.some(i=>i.orderId===orderId&&i.status!=='CANCELLED'))throw Error('Cette commande possède déjà une facture');const customer=o.customerSnapshot||s.customers.find(c=>c.id===o.customerId);if(!customer)throw Error('Client introuvable');
 s.invoices.unshift({id:crypto.randomUUID(),number:'FAC-'+new Date().getFullYear()+'-'+String(s.invoices.length+1).padStart(5,'0'),orderId,status:'DRAFT',createdAt:now,issuedAt:'',shop:structuredClone(s.shop),customer:structuredClone(customer),items:structuredClone(o.items),subtotal:o.subtotal,discount:o.discount,shipping:o.shipping,total:o.total});
 }else{
 const p=z.object({id:z.string()}).parse(payload);const invoice=s.invoices.find(i=>i.id===p.id);if(!invoice)throw Error('Facture introuvable');if(invoice.status!=='DRAFT')throw Error('Une facture émise est figée. Utilisez un retour/avoir pour la rectifier.');if(action==='issueInvoice'){const o=s.orders.find(o=>o.id===invoice.orderId);if(!o||o.status==='CANCELLED'||o.status==='RETURNED')throw Error('La commande a été annulée ou refusée');invoice.status='ISSUED';invoice.issuedAt=now;}else invoice.status='CANCELLED';
 }
 s.audit.unshift({id:crypto.randomUUID(),at:now,label:action==='createInvoice'?'Création d’un brouillon de facture':action==='issueInvoice'?'Émission d’une facture':'Annulation d’un brouillon de facture'});return s;
}
