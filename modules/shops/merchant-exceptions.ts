import type {State} from '../commerce/types';
import {HttpError} from '../auth/http';
export type MerchantExceptionKind='STALLED_SHIPMENT'|'HANDOFF_MISSING'|'DELIVERED_NO_HANDOFF'|'COD_OVERDUE'|'COD_MISMATCH'|'CUSTOMER_REQUEST'|'REFUND_DUE';
export type MerchantException={id:string;orderReference:string;kind:MerchantExceptionKind;
 priority:'HIGH'|'MEDIUM';title:string;detail:string;ageDays:number|null;amountMillimes?:number};
const DAY_MS=86400000;
function age(at:string,now:Date):number|null{
 const t=Date.parse(at);
 return Number.isFinite(t)?Math.max(0,Math.floor((now.getTime()-t)/DAY_MS)):null;
}
export const MERCHANT_EXCEPTION_PAGE_SIZE=100;
export type MerchantExceptionFilter='ALL'|MerchantExceptionKind;
export type MerchantExceptionQuery={page:number;kind:MerchantExceptionFilter};
const exceptionKinds=['STALLED_SHIPMENT','HANDOFF_MISSING','DELIVERED_NO_HANDOFF','COD_OVERDUE','COD_MISMATCH','CUSTOMER_REQUEST','REFUND_DUE'] as const;
export function parseMerchantExceptionQuery(raw:Record<string,string|string[]|undefined>):MerchantExceptionQuery{
 for(const key of Object.keys(raw))
  if(key!=='page'&&key!=='kind')throw new HttpError(400,'Filtre anomalies inconnu');
 const page=raw.page??'1',kind=raw.kind??'ALL';
 if(typeof page!=='string'||!/^[1-9][0-9]{0,6}$/.test(page))
  throw new HttpError(400,'Page anomalies invalide');
 if(typeof kind!=='string'||(kind!=='ALL'&&!exceptionKinds.some(k=>k===kind)))
  throw new HttpError(400,'Catégorie anomalies invalide');
 return {page:Number(page),kind:kind as MerchantExceptionFilter};
}
export function merchantExceptionQueue(state:State,now=new Date(),query:MerchantExceptionQuery={page:1,kind:'ALL'}){
 const issues:MerchantException[]=[];
 const push=(item:MerchantException)=>issues.push(item);
 const handedOff=new Set((state.carrierHandoffs||[]).map(x=>x.orderId));
 for(const order of state.orders){
  const days=age(order.updatedAt,now);
  if(order.status==='SHIPPED'&&days!==null&&days>=4)
   push({id:'stalled:'+order.id,orderReference:order.reference,kind:'STALLED_SHIPMENT',priority:'HIGH',
    title:'Expédition à contrôler',detail:'La commande reste expédiée depuis au moins quatre jours. Vérifiez le suivi avec le transporteur.',ageDays:days});
  if(order.status==='SHIPPED'&&!handedOff.has(order.id)&&days!==null&&days>=1)
   push({id:'handoff:'+order.id,orderReference:order.reference,kind:'HANDOFF_MISSING',priority:'MEDIUM',
    title:'Bon de remise manquant',detail:'Aucune remise physique au transporteur n’a été déclarée dans Tunicom.',ageDays:days});
  if(order.status==='DELIVERED'&&!handedOff.has(order.id)&&days!==null&&days>=1)
   push({id:'delivered-proof:'+order.id,orderReference:order.reference,kind:'DELIVERED_NO_HANDOFF',priority:'MEDIUM',
    title:'Livraison sans bon de remise enregistré',
    detail:'Le statut livré a été saisi manuellement, mais aucune remise physique au transporteur n’est documentée dans Tunicom.',ageDays:days});
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
 const totals=(rows:readonly {orderId:string;amount:number}[])=>{
  const byOrder=new Map<string,number>();
  for(const row of rows)byOrder.set(row.orderId,(byOrder.get(row.orderId)||0)+row.amount);
  return byOrder;
 };
 const statements=totals(state.carrierStatements||[]);
 const settlements=totals(state.settlements||[]);
 for(const order of state.orders){
  if(order.status!=='DELIVERED')continue;
  const difference=(statements.get(order.id)||0)-(settlements.get(order.id)||0);
  if(difference===0)continue;
  push({id:'cod:'+order.reference,orderReference:order.reference,kind:'COD_MISMATCH',
   priority:'HIGH',title:'Écart entre bordereaux et versements COD déclarés',
   detail:'Les montants déclarés ne correspondent pas. Vérification humaine et justificatifs requis.',
   amountMillimes:difference,ageDays:age(order.updatedAt,now)});
 }
 const referenceByOrder=new Map(state.orders.map(o=>[o.id,o.reference]));
 for(const ret of (state.returns||[])){
  const remaining=ret.credit-ret.refunded;
  if(remaining<=0)continue;
  push({id:'refund:'+ret.id,orderReference:referenceByOrder.get(ret.orderId)||'Commande indisponible',
   kind:'REFUND_DUE',priority:'HIGH',title:'Remboursement de retour encore dû',
   detail:'L’avoir enregistré comporte un solde non remboursé. Vérifiez le dossier et le paiement réel.',
   amountMillimes:remaining,ageDays:age(ret.createdAt,now)});
 }
 const kinds=exceptionKinds;
 issues.sort((a,b)=>Number(b.priority==='HIGH')-Number(a.priority==='HIGH')||
  (b.ageDays??-1)-(a.ageDays??-1)||a.id.localeCompare(b.id));
 const filtered=query.kind==='ALL'?issues:issues.filter(item=>item.kind===query.kind);
 const totalPages=Math.max(1,Math.ceil(filtered.length/MERCHANT_EXCEPTION_PAGE_SIZE));
 if(!Number.isSafeInteger(query.page)||query.page<1||query.page>totalPages)
  throw new HttpError(400,'Page anomalies introuvable');
 return {
  total:issues.length,filteredTotal:filtered.length,
  page:query.page,pageSize:MERCHANT_EXCEPTION_PAGE_SIZE,totalPages,kind:query.kind,
  byKind:Object.fromEntries(kinds.map(kind=>[kind,issues.filter(i=>i.kind===kind).length])) as Record<MerchantExceptionKind,number>,
  items:filtered.slice((query.page-1)*MERCHANT_EXCEPTION_PAGE_SIZE,query.page*MERCHANT_EXCEPTION_PAGE_SIZE),
  generatedAt:now.toISOString(),
  note:'Indicateurs calculés à partir des saisies internes. Aucun statut transporteur ou paiement bancaire n’est certifié.'
 };
}
