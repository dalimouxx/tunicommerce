import type {State} from '../commerce/types';
import {normalizeState} from '../commerce/normalize';

export type CommerceIntegrityFinding={
 code:'NEGATIVE_STOCK'|'DUPLICATE_PRODUCT_ID'|'DUPLICATE_SKU'|'WAREHOUSE_BALANCE_MISMATCH'|
 'INVALID_WAREHOUSE_REFERENCE'|'DUPLICATE_CHECKOUT_TOKEN'|'DUPLICATE_ORDER_ID'|'NEGATIVE_WAREHOUSE_BALANCE';
 count:number;
};
const codes:CommerceIntegrityFinding['code'][]=[
 'NEGATIVE_STOCK','DUPLICATE_PRODUCT_ID','DUPLICATE_SKU','WAREHOUSE_BALANCE_MISMATCH',
 'INVALID_WAREHOUSE_REFERENCE','DUPLICATE_CHECKOUT_TOKEN','DUPLICATE_ORDER_ID','NEGATIVE_WAREHOUSE_BALANCE'
];
function duplicateCount(values:string[]){
 const seen=new Set<string>();let duplicates=0;
 for(const value of values){if(seen.has(value))duplicates++;else seen.add(value);}
 return duplicates;
}
/** No names, addresses, phone numbers, order references or product SKUs are returned. */
export function commerceIntegrity(input:State){
 const s=normalizeState(input),counts:Record<string,number>=Object.fromEntries(codes.map(c=>[c,0]));
 counts.NEGATIVE_STOCK=s.products.filter(p=>p.stock<0).length;
 counts.DUPLICATE_PRODUCT_ID=duplicateCount(s.products.map(p=>p.id));
 counts.DUPLICATE_SKU=duplicateCount(s.products.map(p=>p.sku.trim().toUpperCase()));
 counts.DUPLICATE_ORDER_ID=duplicateCount(s.orders.map(o=>o.id));
 counts.DUPLICATE_CHECKOUT_TOKEN=duplicateCount(s.orders.flatMap(o=>o.publicReceiptId?[o.publicReceiptId]:[]));
 if(s.warehouses?.length){
  const valid=new Set(s.warehouses.map(w=>w.id));
  counts.INVALID_WAREHOUSE_REFERENCE=(s.warehouseBalances||[]).filter(b=>!valid.has(b.warehouseId)).length;
  counts.NEGATIVE_WAREHOUSE_BALANCE=(s.warehouseBalances||[]).filter(b=>b.quantity<0).length;
  counts.WAREHOUSE_BALANCE_MISMATCH=s.products.filter(p=>
   (s.warehouseBalances||[]).filter(b=>b.productId===p.id).reduce((n,b)=>n+b.quantity,0)!==p.stock
  ).length;
 }
 return {
  problems:Object.entries(counts).reduce((n,[,count])=>n+count,0),
  findings:codes.map(code=>({code,count:counts[code]})),
  products:s.products.length,orders:s.orders.length,
  checkedWarehouseLedger:!!s.warehouses?.length
 };
}
export function mergeCommerceIntegrity(states:readonly State[]){
 const results=states.map(commerceIntegrity);
 return {
  checkedShops:results.length,
  products:results.reduce((sum,row)=>sum+row.products,0),
  orders:results.reduce((sum,row)=>sum+row.orders,0),
  shopsWithFindings:results.filter(row=>row.problems>0).length,
  totals:codes.map(code=>({
   code,count:results.reduce((sum,row)=>sum+(row.findings.find(f=>f.code===code)?.count||0),0)
  }))
 };
}

/** Admin-only page selection. Never treat one sample as a full audit. */
export const INTEGRITY_PAGE_SIZE=100;
export function parseIntegrityPage(raw:Record<string,string|string[]|undefined>):number{
 for(const key of Object.keys(raw))if(key!=='page')throw Error('Paramètre de fiabilité inconnu');
 const value=raw.page??'1';
 if(typeof value!=='string'||!/^[1-9][0-9]{0,3}$/.test(value))
  throw Error('Page de fiabilité invalide');
 return Number(value);
}
export function integrityTotalPages(total:number):number{
 if(!Number.isSafeInteger(total)||total<0)throw Error('Nombre de boutiques invalide');
 return Math.max(1,Math.ceil(total/INTEGRITY_PAGE_SIZE));
}
