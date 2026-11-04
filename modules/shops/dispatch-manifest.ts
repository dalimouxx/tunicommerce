import type {State} from '../commerce/types';
import {HttpError} from '../auth/http';

export type DispatchRow={
 reference:string;status:string;carrier:string;tracking:string;
 customer:string;phone:string;city:string;address:string;
 items:string;quantity:number;codMillimes:number;
};
export type DispatchStatus='ALL'|'READY'|'SHIPPED';
export type ManifestFormat='csv'|'json';
export type DispatchRequest={page:number;status:DispatchStatus;format:ManifestFormat};
export const DISPATCH_EXPORT_PAGE_SIZE=100;

/** Reject ambiguous query parameters; never allow unbounded PII exports. */
export function parseDispatchManifestQuery(params:URLSearchParams):DispatchRequest{
 const allowed=new Set(['page','status','format']);
 for(const key of params.keys()){
  if(!allowed.has(key)||params.getAll(key).length!==1)throw new HttpError(400,'Paramètres d’export invalides');
 }
 const rawPage=params.get('page')||'1';
 if(!/^[1-9][0-9]{0,3}$/.test(rawPage))throw new HttpError(400,'Numéro de page invalide');
 const status=params.get('status')||'ALL';
 if(!['ALL','READY','SHIPPED'].includes(status))throw new HttpError(400,'Statut de livraison invalide');
 const format=params.get('format')||'csv';
 if(!['csv','json'].includes(format))throw new HttpError(400,'Format d’export invalide');
 return {page:Number(rawPage),status:status as DispatchStatus,format:format as ManifestFormat};
}
function toRow(state:State,order:State['orders'][number]):DispatchRow{
 const customer=order.customerSnapshot||state.customers.find(c=>c.id===order.customerId);
 return {
  reference:order.reference,status:order.status,carrier:order.carrier||'À affecter',
  tracking:order.tracking||'',
  customer:customer?.name||'',phone:customer?.phone||'',city:customer?.city||'',address:customer?.address||'',
  items:order.items.map(item=>item.name+(item.variant?' ('+item.variant+')':'')+' × '+item.quantity).join('; '),
  quantity:order.items.reduce((total,item)=>total+item.quantity,0),codMillimes:order.total
 };
}

/** A stable bounded export page of one shop; summary deliberately excludes buyer PII. */
export function dispatchManifestPage(state:State,query:Pick<DispatchRequest,'status'|'page'>){
 const readyCount=state.orders.filter(order=>order.status==='READY').length;
 const shippedCount=state.orders.filter(order=>order.status==='SHIPPED').length;
 const eligible=state.orders.filter(order=>query.status==='ALL'
  ?order.status==='READY'||order.status==='SHIPPED':order.status===query.status);
 const total=eligible.length;
 const totalPages=Math.max(1,Math.ceil(total/DISPATCH_EXPORT_PAGE_SIZE));
 if(!Number.isSafeInteger(query.page)||query.page<1||query.page>totalPages)
  throw new HttpError(400,'Page introuvable pour ce filtre');
 const start=(query.page-1)*DISPATCH_EXPORT_PAGE_SIZE;
 return {page:query.page,pageSize:DISPATCH_EXPORT_PAGE_SIZE,total,totalPages,readyCount,shippedCount,
  status:query.status,rows:eligible.slice(start,start+DISPATCH_EXPORT_PAGE_SIZE).map(order=>toRow(state,order))};
}
/** Backward-compatible first-page export for internal consumers. */
export function dispatchManifest(state:State):DispatchRow[]{
 return dispatchManifestPage(state,{status:'ALL',page:1}).rows;
}
/** Excel/Sheets-safe CSV: neutralize formulas including invisible Unicode prefix controls. */
export function csvCell(value:string|number):string{
 if(typeof value==='number')return String(value);
 const normalized=value
  .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g,' ')
  .trim();
 const safe=/^[=+@\-]/.test(normalized)?"'"+normalized:normalized;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function dispatchManifestCsv(rows:readonly DispatchRow[]):string{
 const headers=['Commande','État','Transporteur','Suivi','Client','Téléphone','Gouvernorat',
  'Adresse','Articles','Quantité','COD (TND)'];
 const data=rows.map(row=>[
  row.reference,row.status,row.carrier,row.tracking,row.customer,row.phone,row.city,row.address,
  row.items,row.quantity,(row.codMillimes/1000).toFixed(3)
 ].map(csvCell).join(','));
 return '\uFEFF'+[headers.map(csvCell).join(','),...data].join('\r\n')+'\r\n';
}
