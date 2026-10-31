import {z} from 'zod';
import {quoteDelivery} from '../delivery/pricing';
import {applyDelivery} from '../delivery/service';
import {orderSignals} from '../customers/insights';
import {normalizeState} from './normalize';
import {applyReturn} from '../returns/service';
import {applyInvoice} from '../invoices/service';
import {updateCart} from '../cart/service';
import {initialState} from './seed';
import {transitions,labels,governors,type State,type Status} from './types';
const str=z.string().trim().min(1).max(160);const amount=z.number().int().min(0).max(1000000000);const qty=z.number().int().min(1).max(10000);
const schemas={
 createOrder:z.object({name:str,phone:z.string().regex(/^(\+216)?[2459][0-9]{7}$/, 'Numéro tunisien invalide'),city:z.enum(governors as [string,...string[]]),address:str,source:z.enum(['Boutique','Facebook','Instagram','WhatsApp','TikTok','Manuel']),items:z.array(z.object({productId:str,quantity:qty})).min(1).max(100),coupon:z.string().trim().max(50).optional(),notes:z.string().max(2000).optional()}),
 transition:z.object({id:str,status:z.string(),carrier:z.string().max(160).optional(),carrierId:z.string().optional(),tracking:z.string().max(160).optional(),callbackAt:z.string().optional(),restock:z.boolean().optional()}),
 product:z.object({id:z.string().optional(),name:str,sku:str,category:str,variant:z.string().max(100),price:amount,cost:amount,stock:amount,threshold:amount,color:z.string().regex(/^#[a-fA-F0-9]{6}$/)}),
 stock:z.object({id:str,quantity:z.number().int().min(-100000).max(100000),reason:str}),
 expense:z.object({label:str,category:str,amount:amount.refine(n=>n>0),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}),
 settlement:z.object({id:str,amount:amount.refine(n=>n>0),reference:str}),
 coupon:z.object({code:z.string().trim().min(2).max(30),percent:z.number().int().min(1).max(100),limit:qty}),
 settings:z.object({name:str,phone:z.string().max(30),address:z.string().max(200),shipping:amount}),
 note:z.object({id:str,note:str}),
};
export function applyAction(input:State,action:string,payload:unknown):State{
 const s=normalizeState(structuredClone(input)),now=new Date().toISOString();const id=()=>crypto.randomUUID();
 const log=(label:string)=>s.audit.unshift({id:id(),at:now,label});
 const move=(productId:string,quantity:number,label:string,orderId?:string)=>{const p=s.products.find(p=>p.id===productId);if(!p)throw Error('Produit introuvable');if(p.stock+quantity<0)throw Error('Stock insuffisant : '+p.name);p.stock+=quantity;s.movements.unshift({id:id(),productId,quantity,label,at:now,orderId});};
 if(action==='reset'){if((payload as {confirm?:string})?.confirm!=='EFFACER')throw Error('Confirmation requise');return initialState(false);}
 if(['receiveReturn','refundReturn'].includes(action))return applyReturn(s,action,payload);
 if(['createInvoice','issueInvoice','cancelInvoice'].includes(action))return applyInvoice(s,action,payload);
 if(['saveZone','saveCarrier','shipmentCost'].includes(action))return applyDelivery(s,action,payload);
 if(action==='saveCart')return updateCart(s,payload);
 if(action==='checkoutCart'){
  const p=z.object({cartId:z.string().uuid(),customer:schemas.createOrder.omit({items:true,source:true})}).parse(payload);const cart=s.carts.find(c=>c.id===p.cartId);if(!cart||cart.status!=='ACTIVE'||!cart.items.length)throw Error('Panier vide ou déjà converti');
  const next=applyAction(s,'createOrder',{...p.customer,items:cart.items,source:'Boutique'});const updated=next.carts.find(c=>c.id===p.cartId)!;updated.status='CONVERTED';updated.orderId=next.orders[0].id;updated.updatedAt=now;return next;
 }
 if(!(action in schemas))throw Error('Action inconnue');
 const p:any=schemas[action as keyof typeof schemas].parse(payload);
 if(action==='createOrder'){
  const merged=new Map<string,number>();for(const it of p.items)merged.set(it.productId,(merged.get(it.productId)||0)+it.quantity);
  const items=[...merged].map(([productId,quantity])=>{const product=s.products.find(p=>p.id===productId&&p.active);if(!product)throw Error('Produit indisponible');if(quantity>product.stock)throw Error('Stock insuffisant : '+product.name);return {productId,quantity,name:product.name,variant:product.variant,price:product.price,cost:product.cost};});
  const subtotal=items.reduce((n,it)=>n+it.price*it.quantity,0);let discount=0;
  if(p.coupon){const coupon=s.coupons.find(c=>c.code===p.coupon.toUpperCase()&&c.active);if(!coupon||coupon.used>=coupon.limit)throw Error('Coupon invalide ou épuisé');discount=Math.round(subtotal*coupon.percent/100);coupon.used++;}
  const phone=p.phone.replace(/^\+216/,'');let customer=s.customers.find(c=>c.phone===phone);if(!customer){customer={id:id(),name:p.name,phone,city:p.city,address:p.address,notes:''};s.customers.push(customer);}else{customer.name=p.name;customer.city=p.city;customer.address=p.address;}
  const oid=id();for(const it of items)move(it.productId,-it.quantity,'Réservation commande',oid);
  const reference='TC-'+String(1001+s.orders.length);const shipping=quoteDelivery(s,p.city,subtotal-discount);const riskSignals=orderSignals(s,customer.id,items,p.address); 
  s.orders.unshift({id:oid,reference,customerId:customer.id,customerSnapshot:structuredClone(customer),items,status:'TO_CONFIRM',source:p.source,subtotal,discount,shipping:shipping.fee,shippingZone:shipping.zoneName,riskSignals,deliveryCost:7000,total:subtotal-discount+shipping.fee,collected:0,carrier:'',tracking:'',notes:p.notes||'',createdAt:now,updatedAt:now,callbackAt:'',events:[{at:now,label:'Commande créée · Stock réservé'}]});log('Création '+reference);
 }
 if(action==='transition'){
  const o=s.orders.find(o=>o.id===p.id);if(!o)throw Error('Commande introuvable');if(!transitions[o.status].includes(p.status as Status))throw Error('Transition interdite');
  if(p.status==='CALLBACK'){if(!p.callbackAt||!Number.isFinite(Date.parse(p.callbackAt))||Date.parse(p.callbackAt)<Date.now())throw Error('Choisir un rappel dans le futur');o.callbackAt=p.callbackAt;}
  if(p.status==='SHIPPED'){
   if(!p.tracking?.trim())throw Error('Transporteur et numéro de suivi requis');
   if(p.carrierId){const c=s.carriers.find(c=>c.id===p.carrierId&&c.active);if(!c)throw Error('Transporteur indisponible');const city=(o.customerSnapshot||s.customers.find(x=>x.id===o.customerId))?.city;if(!city||!c.governorates.includes(city))throw Error('Transporteur hors zone');o.carrierId=c.id;o.carrier=c.name;o.deliveryCost=c.deliveryCost;o.returnDeliveryCost=c.returnCost;}
   else{if(!p.carrier?.trim())throw Error('Transporteur et numéro de suivi requis');o.carrier=p.carrier;}
   if(s.orders.some(other=>other.id!==o.id&&other.carrier===o.carrier&&other.tracking===p.tracking.trim()))throw Error('Ce numéro de suivi existe déjà pour ce transporteur');
   o.tracking=p.tracking.trim();
  }
  if(p.status==='CANCELLED'||p.status==='RETURNED'&&p.restock===true)for(const it of o.items)move(it.productId,it.quantity,p.status==='CANCELLED'?'Annulation · Stock libéré':'Retour reçu · Remise en stock',o.id);
  o.status=p.status as Status;o.updatedAt=now;o.events.push({at:now,label:labels[o.status]+(o.status==='RETURNED'?(p.restock?' · Remis en stock':' · Produit non revendable'):'')});log(o.reference+' → '+labels[o.status]);
 }
 if(action==='product'){
  if(s.products.some(x=>x.sku===p.sku&&x.id!==p.id))throw Error('SKU déjà utilisé');
  if(p.id){const product=s.products.find(x=>x.id===p.id);if(!product)throw Error('Produit introuvable');const stock=product.stock;Object.assign(product,p,{stock});}else{const product={...p,id:id(),stock:0,active:true};s.products.push(product);move(product.id,p.stock,'Stock initial');}log('Catalogue : '+p.name);
 }
 if(action==='stock'){if(p.quantity===0)throw Error('Quantité nulle');move(p.id,p.quantity,p.reason);log('Ajustement de stock : '+p.reason);}
 if(action==='expense'){s.expenses.unshift({id:id(),...p});log('Dépense : '+p.label);}
 if(action==='settlement'){const o=s.orders.find(o=>o.id===p.id);if(!o||o.status!=='DELIVERED')throw Error('Commande non livrée');if(p.amount>o.total-o.collected)throw Error('Le montant dépasse le COD restant');o.collected+=p.amount;s.settlements.unshift({id:id(),orderId:o.id,amount:p.amount,reference:p.reference,at:now});o.events.push({at:now,label:'Encaissement COD : '+(p.amount/1000).toFixed(3)+' TND'});log('Encaissement '+o.reference);}
 if(action==='coupon'){if(s.coupons.some(c=>c.code===p.code.toUpperCase()))throw Error('Code déjà utilisé');s.coupons.push({...p,id:id(),code:p.code.toUpperCase(),used:0,active:true});log('Coupon : '+p.code);}
 if(action==='settings'){s.shop={...s.shop,...p};log('Paramètres boutique modifiés');}
 if(action==='note'){const o=s.orders.find(o=>o.id===p.id);if(!o)throw Error('Commande introuvable');o.events.push({at:now,label:p.note});log('Note ajoutée à '+o.reference);}
 return s;
}
export function metrics(s:State,orders=s.orders){
 const delivered=orders.filter(o=>o.status==='DELIVERED');const grossRevenue=delivered.reduce((n,o)=>n+o.total,0);const orderIds=new Set(delivered.map(o=>o.id));const returns=(s.returns||[]).filter(r=>orderIds.has(r.orderId));const credits=returns.reduce((n,r)=>n+r.credit,0);const refunds=returns.reduce((n,r)=>n+r.refunded,0);const revenue=grossRevenue-credits;
 const recoveredCost=returns.filter(r=>r.condition==='RESELLABLE').reduce((n,r)=>n+(orders.find(o=>o.id===r.orderId)?.items.find(i=>i.productId===r.productId)?.cost||0)*r.quantity,0);
 const cogs=delivered.reduce((n,o)=>n+o.items.reduce((a,i)=>a+i.cost*i.quantity,0),0)-recoveredCost;const delivery=orders.filter(o=>['DELIVERED','RETURNED'].includes(o.status)).reduce((n,o)=>n+(o.status==='RETURNED'?(o.returnDeliveryCost??o.deliveryCost*2):o.deliveryCost),0)+returns.reduce((n,r)=>n+r.returnCost,0);const expenses=s.expenses.reduce((n,e)=>n+e.amount,0);const collected=delivered.reduce((n,o)=>n+o.collected,0);
 return {revenue,grossRevenue,credits,refunds,refundDue:credits-refunds,cogs,delivery,expenses,collected,pending:grossRevenue-collected,profit:revenue-cogs-delivery-expenses,toConfirm:orders.filter(o=>['TO_CONFIRM','CALLBACK','NO_ANSWER'].includes(o.status)).length,delivered:delivered.length,returned:orders.filter(o=>o.status==='RETURNED').length};
}
