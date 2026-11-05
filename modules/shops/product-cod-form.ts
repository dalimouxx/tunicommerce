/**
 * Pure helpers for the one-page COD order form shown on a public product page.
 * They only shape what the buyer sees; the server recomputes every amount and
 * re-validates stock, coupon and phone when the order is submitted.
 */
export type PublicDeliveryZone={governorates:string[];fee:number;freeAbove:number|null;estimatedDays:number};

export const PRODUCT_FORM_MAX_QUANTITY=10;

/** Accepts the ways Tunisians usually type a number: spaces, dots, dashes, +216, 00216 or 216. */
export function normalizeTunisianPhone(input:string):string{
 const digits=input.replace(/[\s.\-()/]/g,'');
 const local=digits.replace(/^(\+216|00216)/,'').replace(/^216(?=\d{8}$)/,'');
 return local;
}

export function isValidTunisianMobile(input:string):boolean{
 return /^[2459][0-9]{7}$/.test(normalizeTunisianPhone(input));
}

/** Displays 22123456 as "22 123 456" while typing. */
export function formatTunisianPhone(input:string):string{
 const local=normalizeTunisianPhone(input).replace(/\D/g,'').slice(0,8);
 return [local.slice(0,2),local.slice(2,5),local.slice(5,8)].filter(Boolean).join(' ');
}

export function clampQuantity(value:number):number{
 if(!Number.isFinite(value))return 1;
 return Math.min(PRODUCT_FORM_MAX_QUANTITY,Math.max(1,Math.floor(value)));
}

/** Same delivery rule as the storefront cart: zone fee, free above a threshold, else shop default. */
export function estimateDelivery(subtotal:number,city:string,zones:PublicDeliveryZone[],defaultFee:number){
 const zone=city?zones.find(item=>item.governorates.includes(city)):undefined;
 if(!zone)return {fee:defaultFee,free:defaultFee===0,estimatedDays:null as number|null,known:!!city};
 const free=zone.freeAbove!==null&&subtotal>=zone.freeAbove;
 return {fee:free?0:zone.fee,free:free||zone.fee===0,estimatedDays:zone.estimatedDays,known:true};
}

export function productOrderSummary(unitPrice:number,quantity:number,city:string,zones:PublicDeliveryZone[],defaultFee:number){
 const qty=clampQuantity(quantity);
 const subtotal=unitPrice*qty;
 const delivery=estimateDelivery(subtotal,city,zones,defaultFee);
 return {quantity:qty,subtotal,delivery,total:subtotal+delivery.fee};
}

/** Fastest announced delivery across zones, used for the reassurance badge. */
export function fastestDeliveryDays(zones:PublicDeliveryZone[]):number|null{
 const days=zones.map(zone=>zone.estimatedDays).filter(value=>Number.isFinite(value)&&value>0);
 return days.length?Math.min(...days):null;
}
