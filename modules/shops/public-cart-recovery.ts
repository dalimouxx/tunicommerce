/** Browser-only cart recovery: NEVER store names, phone numbers or addresses. */
export type PublicCartItem={id:string;available:boolean};
export const CART_TTL_MS=7*86400000;
export function cartStorageKey(slug:string){
 return 'tunicommerce:cart:'+encodeURIComponent(slug).slice(0,160);
}
export function restoreCartQuantities(
 raw:string|null,products:readonly PublicCartItem[],now=new Date()
):Record<string,number>{
 if(!raw||raw.length>4000)return {};
 try{
  const payload=JSON.parse(raw) as {expiresAt?:unknown;items?:unknown};
  if(typeof payload.expiresAt!=='number'||!Number.isFinite(payload.expiresAt)||
   payload.expiresAt<=now.getTime()||payload.expiresAt>now.getTime()+CART_TTL_MS)return {};
  if(!Array.isArray(payload.items)||payload.items.length>15)return {};
  const allowed=new Set(products.filter(p=>p.available).map(p=>p.id));
  const result:Record<string,number>={};let total=0;
  for(const row of payload.items){
   if(!row||typeof row!=='object')return {};
   const item=row as {productId?:unknown;quantity?:unknown};
   if(typeof item.productId!=='string'||!allowed.has(item.productId)||!Number.isSafeInteger(item.quantity)||
    (item.quantity as number)<1||(item.quantity as number)>10)return {};
   if(Object.prototype.hasOwnProperty.call(result,item.productId))return {};
   result[item.productId]=item.quantity as number;
   total+=item.quantity as number;
  }
  return total<=30?result:{};
 }catch{return {};}
}
export function serializeCartQuantities(
 quantities:Record<string,number>,products:readonly PublicCartItem[],now=new Date()
){
 const allowed=new Set(products.filter(p=>p.available).map(p=>p.id));
 const items=Object.entries(quantities).filter(([id,quantity])=>
  allowed.has(id)&&Number.isSafeInteger(quantity)&&quantity>0&&quantity<=10
 ).slice(0,15).map(([productId,quantity])=>({productId,quantity}));
 if(!items.length||items.reduce((sum,row)=>sum+row.quantity,0)>30)return null;
 return JSON.stringify({expiresAt:now.getTime()+CART_TTL_MS,items});
}
