import type {Product} from '../commerce/types';

export type CatalogEdit={
 name:string;sku:string;category:string;variant:string;
 price:string;cost:string;threshold:string;
};
function millimes(value:string){
 const amount=Number(value);
 if(!Number.isFinite(amount)||amount<0||amount>1_000_000)throw new Error('Prix ou coût invalide');
 return Math.round(amount*1000);
}
export function productEditPayload(existing:Product,edit:CatalogEdit){
 const threshold=Number(edit.threshold);
 if(!Number.isSafeInteger(threshold)||threshold<0||threshold>1_000_000)throw new Error('Seuil de stock invalide');
 return {
  id:existing.id,name:edit.name,sku:edit.sku,category:edit.category,
  variant:edit.variant,price:millimes(edit.price),cost:millimes(edit.cost),
  threshold,color:existing.color,stock:existing.stock
 };
}
function cell(value:string|number){
 if(typeof value==='number')return String(value);
 const text=value.replace(/[\r\n\t]+/g,' ').trim();
 const safe=/^[=+\-@]/.test(text)?"'"+text:text;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function merchantInventoryCsv(products:readonly Product[]){
 const columns=['SKU','Nom','Catégorie','Variante','Prix (TND)','Coût (TND)','Stock','Seuil','Actif'];
 const rows=products.map(item=>[
  item.sku,item.name,item.category,item.variant,(item.price/1000).toFixed(3),
  (item.cost/1000).toFixed(3),item.stock,item.threshold,item.active?'Oui':'Non'
 ].map(cell).join(','));
 return '\uFEFF'+[columns.map(cell).join(','),...rows].join('\r\n')+'\r\n';
}
