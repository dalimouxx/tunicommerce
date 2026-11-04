import type {State} from '../commerce/types';
import {isolatedShopFinanceOverview} from './finance-overview';
import {codAuditPage} from './cod-exceptions';
import type {MerchantWorkspaceTab} from './workspace-tabs';
import {replenishmentQueue} from './operational-queues';

export type MerchantInsight={id:string;priority:'high'|'medium'|'info';title:string;description:string;metric:number;unit:string;targetTab:MerchantWorkspaceTab;actionLabel:string};
export function merchantInsights(state:State,now=new Date()){
 const finance=isolatedShopFinanceOverview(state);
 const recent=state.orders.filter(order=>{
  const at=Date.parse(order.createdAt);
  return Number.isFinite(at)&&at<=now.getTime()&&at>=now.getTime()-30*86400000;
 });
 const awaiting=state.orders.filter(o=>['TO_CONFIRM','NO_ANSWER','CALLBACK'].includes(o.status));
 const cancellations=recent.filter(o=>o.status==='CANCELLED').length;
 const cancellationRate=recent.length?Math.round(cancellations/recent.length*100):0;
 const lowStock=replenishmentQueue(state.products);
 const expiredCallbacks=awaiting.filter(o=>o.status==='CALLBACK'&&(!Number.isFinite(Date.parse(o.callbackAt))||Date.parse(o.callbackAt)<now.getTime()));
 const codIssueCount=codAuditPage(state,{page:1,filter:'ATTENTION'},now).total;
 const pendingRequests=state.orders.reduce((n,o)=>n+(o.customerRequests||[]).filter(req=>req.status==='PENDING').length,0);
 const recordedHandoffs=new Set((state.carrierHandoffs||[]).map(item=>item.orderId));
 const missingHandoffs=state.orders.filter(o=>o.status==='SHIPPED'&&!recordedHandoffs.has(o.id)).length;
 const insights:MerchantInsight[]=[];
 const destination:Record<string,{targetTab:MerchantWorkspaceTab;actionLabel:string}>={
  callbacks:{targetTab:'callcenter',actionLabel:'Ouvrir le Call Center'},
  cod:{targetTab:'finance',actionLabel:'Ouvrir les encaissements'},
  'cod-exceptions':{targetTab:'finance',actionLabel:'Contrôler les écarts COD'},
  returns:{targetTab:'finance',actionLabel:'Ouvrir les retours et remboursements'},
  'client-requests':{targetTab:'callcenter',actionLabel:'Traiter les demandes clients'},
  handoffs:{targetTab:'delivery',actionLabel:'Vérifier les bons de remise'},
  stock:{targetTab:'catalog',actionLabel:'Consulter le stock'},
  cancel:{targetTab:'callcenter',actionLabel:'Analyser les annulations'},
  confirmations:{targetTab:'callcenter',actionLabel:'Confirmer les commandes'},
  ready:{targetTab:'growth',actionLabel:'Voir mon tableau de bord'}
 };
 const add=(id:string,priority:MerchantInsight['priority'],title:string,description:string,metric:number,unit:string)=>
  insights.push({id,priority,title,description,metric,unit,...destination[id]});
 if(expiredCallbacks.length)add('callbacks','high','Rappels en retard','Traitez les rappels avant les nouvelles commandes pour réduire les abandons.',expiredCallbacks.length,'rappels');
 if(finance.outstandingCodMillimes>0)add('cod','high','COD encore non enregistré','Vérifiez les versements et bordereaux ; ce montant reste déclaratif, non certifié par la banque.',finance.outstandingCodMillimes,'millimes');
 if(codIssueCount)add('cod-exceptions','high','Anomalies de livraison et COD','Consultez le rapport complet des écarts, des avoirs et des rapprochements.',codIssueCount,'commandes');
 if(finance.refundsRemainingMillimes>0)add('returns','high','Remboursements à effectuer','Vérifiez les remboursements réellement réalisés avant d’enregistrer leur règlement.',finance.refundsRemainingMillimes,'millimes');
 if(pendingRequests>0)add('client-requests','high','Demandes clients en attente','Les annulations et retours demandés doivent être traités et documentés par le marchand.',pendingRequests,'demandes');
 if(missingHandoffs>0)add('handoffs','medium','Remises transporteur à vérifier','Des colis sont marqués expédiés sans bon de remise enregistré. Vérifiez les justificatifs.',missingHandoffs,'colis');
 if(lowStock.length)add('stock','medium','Réapprovisionnement conseillé','Vérifiez les niveaux de stock avant de lancer une campagne publicitaire.',lowStock.length,'produits');
 if(recent.length>=5&&cancellationRate>=20)add('cancel','medium','Annulations fréquentes sur 30 jours','Examinez les causes avec vos agents, sans attribuer automatiquement un score de risque aux clients.',cancellationRate,'%');
 if(awaiting.length)add('confirmations','info','Commandes à confirmer','Répartissez les commandes entre vos agents Call Center.',awaiting.length,'commandes');
 if(!insights.length)add('ready','info','Aucune alerte métier détectée','Contrôlez régulièrement les demandes clients, le catalogue et les règlements.',0,'alertes');
 const rank={high:0,medium:1,info:2};
 insights.sort((a,b)=>rank[a.priority]-rank[b.priority]||a.id.localeCompare(b.id));
 return {
  mode:'RULES_NOT_AI' as const,
  generatedAt:now.toISOString(),
  scope:'ONE_SHOP' as const,
  periodDays:30,
  summary:{
   ordersLast30Days:recent.length,cancellationRatePercent:cancellationRate,
   awaitingConfirmation:awaiting.length,overdueCallbacks:expiredCallbacks.length,
   lowStockProducts:lowStock.length,
   pendingCustomerRequests:pendingRequests,missingHandoffs,
   refundsDueMillimes:finance.refundsRemainingMillimes,
   outstandingCodMillimes:finance.outstandingCodMillimes,
   estimatedMarginMillimes:finance.estimatedOperatingMarginMillimes
  },
  insights:insights.slice(0,10)
 };
}
