import {prisma} from '../storage/client';
import {isOpen} from './public';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';

export type PlatformShopRow={
 id:string;slug:string|null;name:string;
 ownerId:string;ownerName:string;ownerEmail:string;ownerRole:string;
 published:boolean;open:boolean;plan:string;subscriptionStatus:string;
 subscriptionEndsAt:string|null;updatedAt:string;
 hasLinkedShop:boolean;productCount:number;orderCount:number;
};

export function subscriptionLabel(status:string,endsAt:Date|null,now=new Date()){
 if(status==='SUSPENDED')return 'Suspendu';
 if(status==='CANCELLED')return 'Résilié';
 if(!endsAt||endsAt<=now)return 'Expiré';
 if(status==='TRIAL')return 'Essai';
 if(status==='ACTIVE')return 'Actif';
 return status;
}
export function subscriptionAttention(status:string,endsAt:Date|null,now=new Date()){
 if(status==='SUSPENDED'||status==='CANCELLED')return 'suspended' as const;
 if(!endsAt||endsAt<=now)return 'expired' as const;
 if(endsAt.getTime()-now.getTime()<=7*86400_000)return 'expiring' as const;
 return 'ok' as const;
}
export function legacyShopName(data:unknown):string{
 if(!data||typeof data!=='object'||Array.isArray(data))return 'Boutique sans nom';
 const shop=(data as Record<string,unknown>).shop;
 if(!shop||typeof shop!=='object'||Array.isArray(shop))return 'Boutique sans nom';
 const name=(shop as Record<string,unknown>).name;
 return typeof name==='string'&&name.trim()?name.trim():'Boutique sans nom';
}

export async function loadShopRows(limit=120){
 const rows=await prisma.workspace.findMany({
  select:{
   id:true,ownerId:true,slug:true,data:true,updatedAt:true,plan:true,
   published:true,subscriptionStatus:true,subscriptionEndsAt:true,
   owner:{select:{name:true,email:true,role:true}},
   shop:{select:{id:true}}
  },
  orderBy:{updatedAt:'desc'},
  take:limit
 });
 return rows.map(row=>{
  const state=normalizeState(row.data as unknown as State);
  return {
   id:row.id,slug:row.slug,name:legacyShopName(row.data),
   ownerId:row.ownerId,ownerName:row.owner.name,ownerEmail:row.owner.email,
   ownerRole:row.owner.role,published:row.published,open:isOpen(row),
   plan:row.plan,subscriptionStatus:row.subscriptionStatus,
   subscriptionEndsAt:row.subscriptionEndsAt?.toISOString()||null,
   updatedAt:row.updatedAt.toISOString(),hasLinkedShop:!!row.shop,
   productCount:state.products?.length||0,orderCount:state.orders?.length||0
  } satisfies PlatformShopRow;
 });
}

export async function loadPlatformStats(){
 const now=new Date();
 const week=new Date(now.getTime()+7*86400_000);
 const [merchants,workspaces,organizations,relationalShops,publicShops,expired,expiring,unlinked]=await Promise.all([
  prisma.user.count({where:{role:'MERCHANT'}}),
  prisma.workspace.count(),
  prisma.organization.count(),
  prisma.shop.count(),
  prisma.workspace.count({where:{
   published:true,subscriptionStatus:{in:['TRIAL','ACTIVE']},subscriptionEndsAt:{gt:now}
  }}),
  prisma.workspace.count({where:{
   subscriptionStatus:{in:['TRIAL','ACTIVE']},
   OR:[{subscriptionEndsAt:null},{subscriptionEndsAt:{lte:now}}]
  }}),
  prisma.workspace.count({where:{
   subscriptionStatus:{in:['TRIAL','ACTIVE']},subscriptionEndsAt:{gt:now,lte:week}
  }}),
  prisma.workspace.count({where:{shop:{is:null}}})
 ]);
 return {merchants,workspaces,organizations,relationalShops,publicShops,expired,expiring,unlinked};
}
