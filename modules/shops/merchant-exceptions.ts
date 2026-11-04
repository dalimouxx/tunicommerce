import type {State} from '../commerce/types';
import {codAuditRows} from './cod-exceptions';
export type MerchantExceptionKind='STALLED_SHIPMENT'|'HANDOFF_MISSING'|'DELIVERED_NO_HANDOFF'|'COD_OVERDUE'|'COD_MISMATCH'|'CUSTOMER_REQUEST'|'REFUND_DUE';
export type MerchantException={id:string;orderReference:string;kind:MerchantExceptionKind;
 priority:'HIGH'|'MEDIUM';title:string;detail:string;ageDays:number|null;amountMillimes?:number};
const DAY_MS=86400000;
function age(at:string,now:Date):number|null{
 const t=Date.parse(at);
 return Number.isFinite(t)?Math.max(0,Math.floor((now.getTime()-t)/DAY_MS)):null;
}
export function merchantExceptionQueue(state:State,now=new Date()){
 const issues:MerchantException[]=[];
 const push=(item:MerchantException)=>issues.push(item);
 const handedOff=new Set((state.carrierHandoffs||[]).map(x=>x.orderId));
 for(const order of state.orders.slice(0,5000)){
  const days=age(order.updatedAt,now);
  if(order.status==='SHIPPED'&&days!==null&&days>=4)
   push({id:'stalled:'+order.id,orderReference:order.reference,kind:'STALLED_SHIPMENT',priority:'HIGH',
    title:'Expédition à contrôler',detail:'La commande reste expédiée depuis au moins quatre jours. Vérifiez le suivi avec le transporteur.',ageDays:days});
  if(order.status==='SHIPPED'&&!handedOff.has(order.id)&&days!==null&&days>=1)
   push({id:'handoff:'+order.id,orderReference:order.reference,kind:'HANDOFF_MISSING',priority:'MEDIUM',
    title:'Bon de remise manquant',detail:'Aucune remise physique au transporteur n’a été déclarée dans TuniCommerce.',ageDays:days});
  if(order.status==='DELIVERED'&&!handedOff.has(order.id)&&days!==null&&days>=1)
   push({id:'delivered-proof:'+order.id,orderReference:order.reference,kind:'DELIVERED_NO_HANDOFF',priority:'MEDIUM',
    title:'Livraison sans bon de remise enregistré',
    detail:'Le statut livré a été saisi manuellement, mais aucune remise physique au transporteur n’est documentée dans TuniCommerce.',ageDays:days});
  if(order.status==='DELIVERED'&&days!==null&&days>=3&&order.total>order.collected)
   push({id:'cod-overdue:'+order.id,orderReference:order.reference,kind:'COD_OVERDUE',priority:'HIGH',
    title:'COD livré et non intégralement déclaré encaissé',
    detail:'Une livraison de plus de trois jours présente un solde COD à vérifier avec les justificatifs.',
    ageDays:days,amountMillimes:Math.max(0,order.total-order.collected)});
  for(const req of order.customerRequests||[]){
   if(req.status!=='PENDING')continue;
   push({id:'request:'+req.id,orderReference:order.reference,kind:'CUSTOMER_REQUEST',priority:'HIGH',
    title:req.type==='RETURN'?'Demande de retour à traiter':'Demande d’annulation à traiter',
    detail:'Une demande client reste en attente de décision du marchand.',ageDays:age(req.at,now)});
  }
 }
 for(const item of codAuditRows(state,now)){
  if(item.declaredMinusRegisteredMillimes===0)continue;
  push({id:'cod:'+item.reference,orderReference:item.reference,kind:'COD_MISMATCH',
   priority:'HIGH',title:'Écart entre bordereaux et versements COD déclarés',
   detail:'Les montants déclarés ne correspondent pas. Vérification humaine et justificatifs requis.',
   amountMillimes:item.declaredMinusRegisteredMillimes,ageDays:item.ageDays});
 }
 const referenceByOrder=new Map(state.orders.map(o=>[o.id,o.reference]));
 for(const ret of (state.returns||[]).slice(0,2000)){
  const remaining=ret.credit-ret.refunded;
  if(remaining<=0)continue;
  push({id:'refund:'+ret.id,orderReference:referenceByOrder.get(ret.orderId)||'Commande indisponible',
   kind:'REFUND_DUE',priority:'HIGH',title:'Remboursement de retour encore dû',
   detail:'L’avoir enregistré comporte un solde non remboursé. Vérifiez le dossier et le paiement réel.',
   amountMillimes:remaining,ageDays:age(ret.createdAt,now)});
 }
 const kinds=['STALLED_SHIPMENT','HANDOFF_MISSING','DELIVERED_NO_HANDOFF','COD_OVERDUE','COD_MISMATCH','CUSTOMER_REQUEST','REFUND_DUE'] as const;
 issues.sort((a,b)=>Number(b.priority==='HIGH')-Number(a.priority==='HIGH')||
  (b.ageDays??-1)-(a.ageDays??-1)||a.id.localeCompare(b.id));
 return {
  total:issues.length,
  byKind:Object.fromEntries(kinds.map(kind=>[kind,issues.filter(i=>i.kind===kind).length])) as Record<MerchantExceptionKind,number>,
  items:issues.slice(0,100),generatedAt:now.toISOString(),
  note:'Indicateurs calculés à partir des saisies internes. Aucun statut transporteur ou paiement bancaire n’est certifié.'
 };
}
