import type {Prisma} from '@prisma/client';

export const DIRECTORY_PAGE_SIZE=50;
export type SubscriptionFilter='all'|'valid'|'expiring'|'expired'|'suspended';
const filters:SubscriptionFilter[]=['all','valid','expiring','expired','suspended'];
const active=['ACTIVE','TRIAL'];
const suspended=['SUSPENDED','CANCELLED'];

/** One database-side definition for the list and CSV: no truncated client snapshot. */
export function subscriptionDirectoryQuery(
 input:{statut?:string;recherche?:string;page?:string},
 now=new Date()
){
 const status=filters.includes(input.statut as SubscriptionFilter)
  ?input.statut as SubscriptionFilter:'all';
 const search=(input.recherche||'').trim().slice(0,100);
 const rawPage=input.page||'1';
 const page=/^[1-9][0-9]{0,5}$/.test(rawPage)?Math.min(100000,Number(rawPage)):1;
 const inSevenDays=new Date(now.getTime()+7*86400000);
 let statusWhere:Prisma.WorkspaceWhereInput={};
 if(status==='suspended')statusWhere={subscriptionStatus:{in:suspended}};
 if(status==='valid')statusWhere={
  subscriptionStatus:{in:active},subscriptionEndsAt:{gt:inSevenDays}
 };
 if(status==='expiring')statusWhere={
  subscriptionStatus:{in:active},subscriptionEndsAt:{gt:now,lte:inSevenDays}
 };
 if(status==='expired')statusWhere={AND:[
  {subscriptionStatus:{notIn:suspended}},
  {OR:[
   {subscriptionStatus:{notIn:active}},
   {subscriptionEndsAt:null},
   {subscriptionEndsAt:{lte:now}}
  ]}
 ]};
 const where:Prisma.WorkspaceWhereInput={AND:[
  statusWhere,
  ...(search?[{OR:[
   {slug:{contains:search,mode:'insensitive' as const}},
   {plan:{contains:search,mode:'insensitive' as const}},
   {owner:{is:{name:{contains:search,mode:'insensitive' as const}}}},
   {owner:{is:{email:{contains:search,mode:'insensitive' as const}}}},
   {shop:{is:{name:{contains:search,mode:'insensitive' as const}}}}
  ]}]:[])
 ]};
 return {status,search,page,where};
}
export function directoryPage(page:number,total:number){
 const pages=Math.max(1,Math.ceil(total/DIRECTORY_PAGE_SIZE));
 return {page:Math.min(page,pages),pages};
}
export function directoryHref(path:string,query:{status:SubscriptionFilter;search:string},page:number){
 const params=new URLSearchParams();
 if(query.status!=='all')params.set('statut',query.status);
 if(query.search)params.set('recherche',query.search);
 params.set('page',String(page));
 return path+'?'+params.toString();
}
