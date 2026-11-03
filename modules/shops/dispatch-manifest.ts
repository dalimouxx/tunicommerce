import type {State} from '../commerce/types';

export type DispatchRow={
 reference:string;status:string;carrier:string;tracking:string;
 customer:string;phone:string;city:string;address:string;
 items:string;quantity:number;codMillimes:number;
};
/** Manifest of ready and already shipped orders only; no historical or other-tenant data. */
export function dispatchManifest(state:State):DispatchRow[]{
 return state.orders.filter(order=>order.status==='READY'||order.status==='SHIPPED').slice(0,100).map(order=>{
  const customer=order.customerSnapshot||state.customers.find(c=>c.id===order.customerId);
  return {
   reference:order.reference,status:order.status,carrier:order.carrier||'À affecter',
   tracking:order.tracking||'',
   customer:customer?.name||'',phone:customer?.phone||'',city:customer?.city||'',address:customer?.address||'',
   items:order.items.map(item=>item.name+(item.variant?' ('+item.variant+')':'')+' × '+item.quantity).join('; '),
   quantity:order.items.reduce((total,item)=>total+item.quantity,0),codMillimes:order.total
  };
 });
}
/** Excel/Sheets-safe CSV, with dangerous user-controlled spreadsheet formulas neutralized. */
export function csvCell(value:string|number):string{
 if(typeof value==='number')return String(value);
 const normalized=value.replace(/[\r\n\t]+/g,' ').trim();
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
