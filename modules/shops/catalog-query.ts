import {z} from 'zod';
import type {Product} from '../commerce/types';
export const catalogQuery=z.object({
 q:z.string().trim().max(100).default(''),
 page:z.coerce.number().int().min(1).max(1_000_000).default(1),
 pageSize:z.coerce.number().int().min(1).max(100).default(40),
 status:z.enum(['all','active','inactive']).default('all'),
 stock:z.enum(['all','low','out']).default('all')
}).strict();
export type CatalogQuery=z.infer<typeof catalogQuery>;
export function catalogSearch(value:string){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
export function catalogMatches(product:Product,query:CatalogQuery){
 return (query.status==='all'||product.active===(query.status==='active'))&&
  (query.stock==='all'||product.active&&(query.stock==='low'?product.stock<=product.threshold:product.stock===0))&&
  (!query.q||catalogSearch([product.name,product.sku,product.category,product.variant].join(' ')).includes(catalogSearch(query.q)));
}
export function catalogPage(total:number,input:CatalogQuery){
 const pages=Math.max(1,Math.ceil(total/input.pageSize)),page=Math.min(input.page,pages);
 return {total,page,pages,pageSize:input.pageSize,offset:(page-1)*input.pageSize};
}
