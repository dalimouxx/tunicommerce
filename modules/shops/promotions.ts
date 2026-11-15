import {z} from 'zod';

/** A dated promotional price. The regular price stays the product price; the promotion never outlives endsAt. */
export type Promotion={price:number;startsAt:string;endsAt:string};
type Promoted={price:number;promotion?:Promotion};

const isoDate=z.string().max(40).refine(value=>!Number.isNaN(Date.parse(value))&&/^\d{4}-\d{2}-\d{2}T/.test(value),'Date invalide');
export const promotionSchema=z.object({
 price:z.number().int().min(1,'Prix promo invalide').max(1000000000),
 startsAt:isoDate,endsAt:isoDate
}).strict();
export const productPromotionPayload=z.object({
 productId:z.string().min(1).max(160),
 promotion:promotionSchema.nullable()
}).strict();
export const productPromotionMutation=z.object({
 action:z.literal('productPromotion'),requestId:z.string().uuid(),payload:productPromotionPayload
}).strict();

/** Tunisia is UTC+1 all year (no daylight saving). Input comes from <input type="datetime-local">. */
export function tunisLocalToIso(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Date invalide');
 const date=new Date(value+':00+01:00');
 if(Number.isNaN(date.getTime()))throw Error('Date invalide');
 return date.toISOString();
}
export function isoToTunisLocal(value:string){
 const date=new Date(Date.parse(value)+3600_000);
 return Number.isNaN(date.getTime())?'':date.toISOString().slice(0,16);
}
export function assertValidPromotion(regularPrice:number,promotion:Promotion,now:Date){
 if(promotion.price>=regularPrice)throw Error('Le prix promo doit être inférieur au prix normal ('+(regularPrice/1000).toFixed(3)+' TND)');
 const start=Date.parse(promotion.startsAt),end=Date.parse(promotion.endsAt);
 if(end<=start)throw Error('La fin de la promotion doit être après son début');
 if(end<=now.getTime())throw Error('La fin de la promotion doit être dans le futur');
 return {price:promotion.price,startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString()};
}
/** Active only inside [startsAt, endsAt) and only while still cheaper than the current regular price. */
export function activePromotion(product:Promoted,now:Date){
 const promotion=product.promotion;
 if(!promotion||promotion.price>=product.price)return null;
 const time=now.getTime();
 return Date.parse(promotion.startsAt)<=time&&time<Date.parse(promotion.endsAt)?promotion:null;
}
export function effectivePrice(product:Promoted,now:Date){return activePromotion(product,now)?.price??product.price;}
/** Public view of an active promotion: what the storefront needs for a struck-through price. */
export function promotionView(product:Promoted,now:Date){
 const promotion=activePromotion(product,now);
 return promotion?{regularPrice:product.price,endsAt:promotion.endsAt,percent:Math.round((1-promotion.price/product.price)*100)}:null;
}

type MerchantProduct={id:string;name:string;variant:string;price:number;active:boolean;promotion?:Promotion};
/** Merchant-side list: status plus Tunis-local values ready for datetime-local inputs. */
export function merchantPromotionsView(products:readonly MerchantProduct[],now:Date){
 return products.filter(product=>product.active).map(product=>{
  const promotion=product.promotion;
  const status=!promotion?'NONE':activePromotion(product,now)?'ACTIVE':Date.parse(promotion.endsAt)<=now.getTime()?'ENDED':Date.parse(promotion.startsAt)>now.getTime()?'SCHEDULED':'INVALID';
  return {id:product.id,name:product.name,variant:product.variant,price:product.price,status,
   promotion:promotion?{price:promotion.price,startsAt:promotion.startsAt,endsAt:promotion.endsAt,
    startsLocal:isoToTunisLocal(promotion.startsAt),endsLocal:isoToTunisLocal(promotion.endsAt)}:null};
 });
}
