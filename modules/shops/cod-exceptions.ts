import type {State} from '../commerce/types';
import {csvCell} from './dispatch-manifest';

export type CodAuditRow={
 reference:string;carrier:string;deliveredAt:string;ageDays:number|null;
 totalMillimes:number;returnCreditsMillimes:number;registeredCodMillimes:number;
 outstandingGrossMillimes:number;declaredMillimes:number;
 matchedManuallyMillimes:number;declaredMinusRegisteredMillimes:number;
 attention:string
};

/** Read-only COD exception review: financial figures are still operator declarations. */
export function codAuditRows(state:State,now=new Date()):CodAuditRow[]{
 const reconciled=new Set((state.carrierReconciliations||[]).map(row=>row.statementId));
 return state.orders.filter(o=>o.status==='DELIVERED').slice(0,1000).map(order=>{
  const statements=(state.carrierStatements||[]).filter(row=>row.orderId===order.id);
  const settlements=state.settlements.filter(row=>row.orderId===order.id);
  const declared=statements.reduce((sum,row)=>sum+row.amount,0);
  const registered=settlements.reduce((sum,row)=>sum+row.amount,0);
  const matched=statements.filter(row=>reconciled.has(row.id)).reduce((sum,row)=>sum+row.amount,0);
  const credits=(state.returns||[]).filter(row=>row.orderId===order.id).reduce((sum,row)=>sum+row.credit,0);
  const last=Date.parse(order.updatedAt);
  const ageDays=Number.isFinite(last)?Math.max(0,Math.floor((now.getTime()-last)/86400000)):null;
  const issues:string[]=[];
  if(order.collected<order.total)issues.push('COD non integralement enregistre');
  if(declared!==registered)issues.push('Ecart bordereaux/versements');
  if(Math.min(declared,registered)>matched)issues.push('Rapprochement incomplet');
  if(!order.carrier.trim())issues.push('Transporteur manquant');
  if(credits>0)issues.push('Avoirs a controler');
  return {
   reference:order.reference,carrier:order.carrier||'Non renseigne',
   deliveredAt:order.updatedAt,ageDays,totalMillimes:order.total,
   returnCreditsMillimes:credits,registeredCodMillimes:registered,
   outstandingGrossMillimes:Math.max(0,order.total-order.collected),
   declaredMillimes:declared,matchedManuallyMillimes:matched,
   declaredMinusRegisteredMillimes:declared-registered,attention:issues.join(' / ')||'Aucun ecart detecte'
  };
 }).sort((a,b)=>{
  const aNeeds=a.attention!=='Aucun ecart detecte',bNeeds=b.attention!=='Aucun ecart detecte';
  return Number(bNeeds)-Number(aNeeds)||(b.ageDays??-1)-(a.ageDays??-1)||a.reference.localeCompare(b.reference);
 });
}
export function codAuditCsv(rows:readonly CodAuditRow[]):string{
 const headers=['Commande','Transporteur','Dernier statut livre ISO','Age jours',
  'Total commande TND','Avoirs TND','Versements COD enregistres TND','COD brut non enregistre TND',
  'Bordereaux declares TND','Rapproches manuellement TND','Ecart declare moins enregistre TND','Attention'];
 const data=rows.map(row=>[
  row.reference,row.carrier,row.deliveredAt,row.ageDays===null?'':row.ageDays,
  (row.totalMillimes/1000).toFixed(3),(row.returnCreditsMillimes/1000).toFixed(3),
  (row.registeredCodMillimes/1000).toFixed(3),(row.outstandingGrossMillimes/1000).toFixed(3),
  (row.declaredMillimes/1000).toFixed(3),(row.matchedManuallyMillimes/1000).toFixed(3),
  (row.declaredMinusRegisteredMillimes/1000).toFixed(3),row.attention
 ].map(csvCell).join(','));
 return '\uFEFF'+[headers.map(csvCell).join(','),...data].join('\r\n')+'\r\n';
}
