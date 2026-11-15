import {absoluteUrl} from './urls';

/** Serialises JSON-LD so merchant text can never close the <script> element. */
export function jsonLdScript(data:unknown){
 return JSON.stringify(data)
  .replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')
  .replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
}
type ProductInput={name:string;description:string;imageUrl:string;url:string;price:number;available:boolean;storeName:string;origin:string;priceValidUntil?:string};
/** Product schema with a real offer only; ratings appear once verified reviews exist. */
export function productJsonLd(input:ProductInput){
 const image=absoluteUrl(input.origin,input.imageUrl);
 return {
  '@context':'https://schema.org','@type':'Product',name:input.name,
  ...(input.description?{description:input.description}:{}),
  ...(image?{image}:{}),url:input.url,
  brand:{'@type':'Brand',name:input.storeName},
  offers:{'@type':'Offer',url:input.url,priceCurrency:'TND',price:(input.price/1000).toFixed(3),
   availability:input.available?'https://schema.org/InStock':'https://schema.org/OutOfStock',
   ...(input.priceValidUntil?{priceValidUntil:input.priceValidUntil.slice(0,10)}:{}),
   seller:{'@type':'Organization',name:input.storeName}}
 };
}
export function storeJsonLd(input:{name:string;description:string;url:string;logoUrl:string;origin:string}){
 const logo=absoluteUrl(input.origin,input.logoUrl);
 return {'@context':'https://schema.org','@type':'Store',name:input.name,url:input.url,
  ...(input.description?{description:input.description}:{}),...(logo?{logo,image:logo}:{}),
  currenciesAccepted:'TND',paymentAccepted:'Cash on delivery',areaServed:'TN'};
}
