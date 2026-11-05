import {z} from 'zod';

/**
 * Quantity offers ("1 pièce 49 DT, 2 pièces 89 DT, 3 pièces 119 DT").
 * An offer is the TOTAL price for an exact quantity of one product.
 * The server applies it in createOrder; the storefront only displays the same computation.
 */
export type QuantityOffer={quantity:number;price:number;label:string};
type Priced={price:number;quantityOffers?:QuantityOffer[]};

export const MAX_QUANTITY_OFFERS=4;

const offer=z.object({
 quantity:z.number().int().min(2,'Une offre commence à 2 pièces').max(10,'10 pièces maximum par offre'),
 price:z.number().int().min(1,'Prix de l’offre invalide').max(1000000000),
 label:z.string().trim().max(40,'Étiquette trop longue (40 caractères maximum)')
}).strict();

export const quantityOffersPayload=z.object({
 productId:z.string().min(1).max(160),
 offers:z.array(offer).max(MAX_QUANTITY_OFFERS,'4 offres maximum par produit')
}).strict().superRefine((value,ctx)=>{
 const seen=new Set<number>();
 for(const item of value.offers){
  if(seen.has(item.quantity))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Une seule offre par quantité'});
  seen.add(item.quantity);
 }
});

export const quantityOffersMutation=z.object({
 action:z.literal('quantityOffers'),requestId:z.string().uuid(),payload:quantityOffersPayload
}).strict();

/** Offers must be strictly cheaper than buying the pieces one by one. */
export function assertValidOffers(unitPrice:number,offers:QuantityOffer[]){
 for(const item of offers){
  if(item.price>=unitPrice*item.quantity)
   throw Error('L’offre '+item.quantity+' pièces doit coûter moins de '+((unitPrice*item.quantity)/1000).toFixed(3)+' TND');
 }
 return [...offers].sort((a,b)=>a.quantity-b.quantity);
}

/** Exact-quantity match only; an offer that is no longer cheaper (price raised since) is ignored. */
export function offerForQuantity(product:Priced,quantity:number):QuantityOffer|null{
 const match=product.quantityOffers?.find(item=>item.quantity===quantity);
 return match&&match.price<product.price*quantity?match:null;
}

export function linePrice(product:Priced,quantity:number){
 const full=product.price*quantity;
 const match=offerForQuantity(product,quantity);
 return {full,total:match?match.price:full,saving:match?full-match.price:0,offer:match};
}

/** Public list shown on the product page: the single piece first, then valid offers. */
export function publicQuantityOffers(product:Priced){
 const offers=(product.quantityOffers||[]).filter(item=>item.price<product.price*item.quantity)
  .sort((a,b)=>a.quantity-b.quantity);
 if(!offers.length)return [];
 return [{quantity:1,price:product.price,label:'',saving:0},
  ...offers.map(item=>({quantity:item.quantity,price:item.price,label:item.label,saving:product.price*item.quantity-item.price}))];
}
