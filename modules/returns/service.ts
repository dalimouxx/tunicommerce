import {z} from 'zod';
import {applyWarehouseMovement} from '../warehouse/ledger';
import type {State,Order} from '../commerce/types';
const returnSchema=z.object({orderId:z.string(),productId:z.string(),quantity:z.number().int().min(1).max(10000),reason:z.string().trim().min(3).max(500),condition:z.enum(['RESELLABLE','DAMAGED']),returnCost:z.number().int().min(0).max(1000000)});
const refundSchema=z.object({id:z.string(),amount:z.number().int().min(1).max(1000000000),reference:z.string().trim().min(1).max(160)});
export function returnCredit(o:Order,productId:string,already:number,quantity:number){
 let cumulative=0;for(const i of o.items){const gross=i.price*i.quantity;const allocated=o.subtotal?Math.floor(o.discount*(cumulative+gross)/o.subtotal)-Math.floor(o.discount*cumulative/o.subtotal):0;cumulative+=gross;if(i.productId===productId){const net=gross-allocated;return Math.floor(net*(already+quantity)/i.quantity)-Math.floor(net*already/i.quantity);}}
 throw Error('Article introuvable');
}
export function applyReturn(s:State,action:string,payload:unknown){const now=new Date().toISOString();const id=()=>crypto.randomUUID();
 if(action==='receiveReturn'){
 const p=returnSchema.parse(payload);const o=s.orders.find(o=>o.id===p.orderId);if(!o||o.status!=='DELIVERED')throw Error('Seule une commande livrée peut faire l’objet d’un retour après vente');
 const item=o.items.find(i=>i.productId===p.productId);if(!item)throw Error('Article absent de la commande');
 const already=s.returns.filter(r=>r.orderId===o.id&&r.productId===p.productId).reduce((n,r)=>n+r.quantity,0);if(already+p.quantity>item.quantity)throw Error('La quantité dépasse le nombre d’articles restant à retourner');
 const reference='RET-'+String(1001+s.returns.length);const credit=returnCredit(o,p.productId,already,p.quantity);
 s.returns.unshift({id:id(),reference,...p,credit,refunded:0,createdAt:now,refunds:[]});
 if(p.condition==='RESELLABLE'){const product=s.products.find(x=>x.id===p.productId);if(!product)throw Error('Produit introuvable');applyWarehouseMovement(s,product.id,p.quantity);product.stock+=p.quantity;s.movements.unshift({id:id(),productId:product.id,quantity:p.quantity,label:reference+' · Retour après livraison contrôlé',at:now,orderId:o.id});}
 o.events.push({at:now,label:reference+' · '+p.quantity+' × '+item.name+' · Avoir '+(credit/1000).toFixed(3)+' TND'});s.audit.unshift({id:id(),at:now,label:'Réception '+reference+' sur '+o.reference});
 }else if(action==='refundReturn'){
 const p=refundSchema.parse(payload);const r=s.returns.find(r=>r.id===p.id);if(!r)throw Error('Retour introuvable');if(p.amount>r.credit-r.refunded)throw Error('Le remboursement dépasse l’avoir restant');
 r.refunded+=p.amount;r.refunds.push({amount:p.amount,reference:p.reference,at:now});const o=s.orders.find(o=>o.id===r.orderId)!;o.events.push({at:now,label:r.reference+' · Remboursement enregistré '+(p.amount/1000).toFixed(3)+' TND'});s.audit.unshift({id:id(),at:now,label:'Remboursement '+r.reference+' · '+p.reference});
 }
 return s;
}
