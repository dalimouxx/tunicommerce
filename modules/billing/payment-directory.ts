import type {Prisma} from '@prisma/client';

export const PAYMENT_PAGE_SIZE=50;
export const PAYMENT_STATUSES=['ALL','PENDING','APPROVED','REJECTED'] as const;
export type PaymentFilter=typeof PAYMENT_STATUSES[number];
export type PaymentQueryInput={status?:string;method?:string;recherche?:string;page?:string};
export function paymentDirectoryQuery(input:PaymentQueryInput){
 const status:PaymentFilter=PAYMENT_STATUSES.includes(input.status as PaymentFilter)?input.status as PaymentFilter:'PENDING';
 const method=['D17','BANK_TRANSFER','CASH'].includes(input.method||'')?input.method!:'';
 const search=typeof input.recherche==='string'?input.recherche.trim().slice(0,100):'';
 const rawPage=typeof input.page==='string'?input.page:'1';
 const page=/^[1-9][0-9]{0,5}$/.test(rawPage)?Math.min(100000,Number(rawPage)):1;
 const where:Prisma.SubscriptionPaymentWhereInput={
  ...(status!=='ALL'?{status}:{}),...(method?{method}:{}),
  ...(search?{OR:[
   {reference:{contains:search,mode:'insensitive'}},
   {transferReference:{contains:search,mode:'insensitive'}},
   {planName:{contains:search,mode:'insensitive'}},
   {planCode:{contains:search,mode:'insensitive'}},
   {workspace:{is:{slug:{contains:search,mode:'insensitive'}}}},
   {workspace:{is:{owner:{is:{name:{contains:search,mode:'insensitive'}}}}}},
   {workspace:{is:{owner:{is:{email:{contains:search,mode:'insensitive'}}}}}}
  ]}:{}),
 };
 return {status,method,search,page,where};
}
export function paymentDirectoryPage(page:number,count:number){
 const pages=Math.max(1,Math.ceil(count/PAYMENT_PAGE_SIZE));
 return {page:Math.min(page,pages),pages};
}
export function paymentDirectoryHref(path:string,query:{status:PaymentFilter;method:string;search:string},page?:number){
 const params=new URLSearchParams({status:query.status});
 if(query.method)params.set('method',query.method);
 if(query.search)params.set('recherche',query.search);
 if(page!==undefined)params.set('page',String(page));
 return path+'?'+params.toString();
}
