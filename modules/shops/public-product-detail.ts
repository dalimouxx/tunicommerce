import type {State} from '../commerce/types';
import {isolatedStorefrontPreview} from './storefront-preview';
export function publicProductDetail(state:State,productId:string){
 const catalog=isolatedStorefrontPreview(state);
 const product=catalog.products.find(item=>item.id===productId);
 if(!product)return null;
 const similar=catalog.products.filter(item=>item.id!==productId&&item.category===product.category&&item.available)
  .slice(0,4).map(item=>({id:item.id,name:item.name,price:item.price,variant:item.variant}));
 return {
  store:{name:catalog.name,description:catalog.description,theme:catalog.theme},
  product:{id:product.id,name:product.name,category:product.category,variant:product.variant,
   price:product.price,description:product.description,available:product.available,imageUrl:product.imageUrl},
  similar
 };
}
