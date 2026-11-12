import {z} from 'zod';
import type {ShopCatalogProduct,Prisma} from '@prisma/client';
import type {Product} from '../commerce/types';
import {catalogSearch} from './catalog-query';
const exact=z.number().int().nonnegative();
const productCore=z.object({id:z.string().min(1),name:z.string(),sku:z.string(),category:z.string(),variant:z.string(),
 price:exact,cost:exact,stock:exact,threshold:exact,color:z.string(),active:z.boolean()}).passthrough();
export function catalogProductRecord(shopId:string,product:Product,ordinal:number):Prisma.ShopCatalogProductCreateManyInput{
 const p=productCore.parse(product);
 const {id,name,sku,category,variant,price,cost,stock,threshold,color,active,...extra}=p;
 return {shopId,productId:id,ordinal,name,sku,category,variant,price:BigInt(price),cost:BigInt(cost),stock:BigInt(stock),threshold:BigInt(threshold),color,active,
  lowStock:active&&stock<=threshold,searchText:catalogSearch([name,sku,category,variant].join(' ')),
  extra:JSON.parse(JSON.stringify(extra)) as Prisma.InputJsonValue};
}
export function catalogProductValue(row:ShopCatalogProduct):Product{
 const number=(value:bigint)=>{const n=Number(value);if(!Number.isSafeInteger(n))throw Error('Entier catalogue hors limites');return n;};
 return {...(row.extra as Record<string,unknown>),id:row.productId,name:row.name,sku:row.sku,category:row.category,variant:row.variant,
  price:number(row.price),cost:number(row.cost),stock:number(row.stock),threshold:number(row.threshold),color:row.color,active:row.active} as Product;
}
