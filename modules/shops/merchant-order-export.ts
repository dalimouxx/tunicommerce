export type MerchantOrderExportRow={
 reference:string;status:string;total:number;source:string;createdAt:string;
 items:readonly {name:string;quantity:number}[]
};
/** Private browser-only export: deliberately excludes customer contact data and bearer URLs. */
function safeCsvCell(value:string|number):string{
 if(typeof value==='number')return String(value);
 const normalized=value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g,' ').trim();
 const neutral=/^[=+@\-]/.test(normalized)?"'"+normalized:normalized;
 return '"'+neutral.replace(/"/g,'""')+'"';
}
export function merchantOrdersCsv(orders:readonly MerchantOrderExportRow[]):string{
 const headers=['Commande','Statut','Produits','Nombre d’articles','Source',
  'Montant TND','Date de création'];
 const rows=orders.map(order=>{
  if(!Number.isSafeInteger(order.total)||order.total<0)throw Error('Montant de commande invalide');
  const count=order.items.reduce((n,item)=>n+item.quantity,0);
  if(!Number.isSafeInteger(count)||count<0)throw Error('Quantité de commande invalide');
  const names=order.items.map(item=>item.name+' × '+item.quantity).join(' ; ');
  return [order.reference,order.status,names,count,order.source,
   (order.total/1000).toFixed(3),order.createdAt].map(safeCsvCell).join(',');
 });
 return '\uFEFF'+[headers.map(safeCsvCell).join(','),...rows].join('\r\n')+'\r\n';
}
