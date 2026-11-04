import type {State} from '../commerce/types';
import {csvCell} from './dispatch-manifest';
import {HttpError} from '../auth/http';

export type CodAuditRow={
 reference:string;carrier:string;deliveredAt:string;ageDays:number|null;
 totalMillimes:number;returnCreditsMillimes:number;registeredCodMillimes:number;
 outstandingGrossMillimes:number;declaredMillimes:number;
 matchedManuallyMillimes:number;declaredMinusRegisteredMillimes:number;
 attention:string
};

/** Read-only COD exception review: financial figures are still operator declarations. */
function allCodAuditRows(state:State,now:Date):CodAuditRow[]{
 const reconciled=new Set((state.carrierReconciliations||[]).map(row=>row.statementId));
 return state.orders.filter(o=>o.status==='DELIVERED').map(order=>{
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

/** Compatibility projection for older internal consumers, intentionally capped. */
export function codAuditRows(state:State,now=new Date()):CodAuditRow[]{
 return allCodAuditRows(state,now).slice(0,1000);
}
export type CodAuditFilter='ALL'|'ATTENTION'|'CLEAN';
export type CodAuditQuery={page:number;filter:CodAuditFilter;format:'csv'|'json'};
export const COD_AUDIT_PAGE_SIZE=100;
export function parseCodAuditQuery(params:URLSearchParams):CodAuditQuery{
 const allowed=new Set(['page','filter','format']);
 for(const key of params.keys())
  if(!allowed.has(key)||params.getAll(key).length!==1)
   throw new HttpError(400,'Paramètres de contrôle COD invalides');
 const page=params.get('page')||'1';
 if(!/^[1-9][0-9]{0,3}$/.test(page))throw new HttpError(400,'Page COD invalide');
 const filter=params.get('filter')||'ALL',format=params.get('format')||'csv';
 if(!['ALL','ATTENTION','CLEAN'].includes(filter))throw new HttpError(400,'Filtre COD invalide');
 if(!['csv','json'].includes(format))throw new HttpError(400,'Format COD invalide');
 return {page:Number(page),filter:filter as CodAuditFilter,format:format as 'csv'|'json'};
}
/** All eligible COD orders are counted; only the selected bounded page is exposed. */
export function codAuditPage(state:State,input:Pick<CodAuditQuery,'page'|'filter'>,now=new Date()){
 const rows=allCodAuditRows(state,now);
 const attentionCount=rows.filter(row=>row.attention!=='Aucun ecart detecte').length;
 const filtered=rows.filter(row=>input.filter==='ALL'||
  (input.filter==='ATTENTION'?row.attention!=='Aucun ecart detecte':row.attention==='Aucun ecart detecte'));
 const total=filtered.length,totalPages=Math.max(1,Math.ceil(total/COD_AUDIT_PAGE_SIZE));
 if(!Number.isSafeInteger(input.page)||input.page<1||input.page>totalPages)
  throw new HttpError(400,'Page de contrôle COD introuvable');
 const start=(input.page-1)*COD_AUDIT_PAGE_SIZE;
 return {page:input.page,pageSize:COD_AUDIT_PAGE_SIZE,total,totalPages,attentionCount,
  cleanCount:rows.length-attentionCount,filter:input.filter,
  rows:filtered.slice(start,start+COD_AUDIT_PAGE_SIZE)};
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
