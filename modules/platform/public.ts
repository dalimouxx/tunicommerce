import type {State} from '../commerce/types';
import {publicQuantityOffers} from '../shops/quantity-offers';
export function isOpen(shop:{published:boolean;subscriptionStatus:string;subscriptionEndsAt:Date|null},now=new Date()){
 return shop.published&&['TRIAL','ACTIVE'].includes(shop.subscriptionStatus)&&!!shop.subscriptionEndsAt&&shop.subscriptionEndsAt>now;
}
export function publicCatalog(state:State){return {description:state.shop.description||'',logoUrl:state.shop.logoUrl||'',bannerUrl:state.shop.bannerUrl||'',name:state.shop.name,phone:state.shop.phone,shipping:state.shop.shipping,demo:state.demo,zones:state.zones.filter(z=>z.active).map(({governorates,fee,freeAbove,estimatedDays})=>({governorates,fee,freeAbove,estimatedDays})),products:state.products.filter(p=>p.active).map(({id,name,category,variant,price,stock,description,imageUrl,quantityOffers})=>({id,name,category,variant,price,description:description||'',imageUrl:imageUrl||'',available:stock>0,offers:publicQuantityOffers({price,quantityOffers})}))};}
export type PublicCatalog=ReturnType<typeof publicCatalog>;
