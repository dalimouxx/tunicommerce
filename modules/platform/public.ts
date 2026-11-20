import type {State} from '../commerce/types';
import {publicQuantityOffers} from '../shops/quantity-offers';
import {effectivePrice,promotionView} from '../shops/promotions';
import {productPhotoUrls} from '../product-media/gallery';
import {publicProductImageUrl} from '../shops/public-catalog-filters';
export function isOpen(shop:{published:boolean;subscriptionStatus:string;subscriptionEndsAt:Date|null},now=new Date()){
 return shop.published&&['TRIAL','ACTIVE'].includes(shop.subscriptionStatus)&&!!shop.subscriptionEndsAt&&shop.subscriptionEndsAt>now;
}
/** Prices are those in force at `now`; the checkout recomputes them on the server. */
export function publicCatalog(state:State,now=new Date()){return {description:state.shop.description||'',logoUrl:state.shop.logoUrl||'',bannerUrl:state.shop.bannerUrl||'',name:state.shop.name,phone:state.shop.phone,shipping:state.shop.shipping,demo:state.demo,zones:state.zones.filter(z=>z.active).map(({governorates,fee,freeAbove,estimatedDays})=>({governorates,fee,freeAbove,estimatedDays})),products:state.products.filter(p=>p.active).map(({id,name,category,variant,price:regular,stock,description,imageUrl,gallery,quantityOffers,promotion})=>{const price=effectivePrice({price:regular,promotion},now);return {id,name,category,variant,price,description:description||'',imageUrl:imageUrl||'',images:productPhotoUrls({imageUrl,gallery}).map(publicProductImageUrl).filter(Boolean),available:stock>0,offers:publicQuantityOffers({price,quantityOffers}),promotion:promotionView({price:regular,promotion},now)};})};}
export type PublicCatalog=ReturnType<typeof publicCatalog>;
