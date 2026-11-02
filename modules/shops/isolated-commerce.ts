import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {initialState} from '../commerce/seed';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {HttpError} from '../auth/http';

export function mayInitializeCommerce(input:{
 active:boolean;role:string;legacyWorkspaceId:string|null
}):boolean{
 return input.active&&input.role==='OWNER'&&input.legacyWorkspaceId===null;
}

export async function requireIsolatedOwner(userId:string,shopId:string){
 const member=await prisma.membership.findUnique({
  where:{shopId_userId:{shopId,userId}},
  select:{active:true,role:true,shop:{select:{id:true,name:true,legacyWorkspaceId:true}}}
 });
 if(!member?.active)throw new HttpError(404,'Boutique introuvable');
 if(!mayInitializeCommerce({active:member.active,role:member.role,legacyWorkspaceId:member.shop.legacyWorkspaceId}))
  throw new HttpError(403,'Accès à cet espace commercial interdit');
 return member.shop;
}
export function newShopState(name:string):State{
 const state=initialState(false);
 state.shop.name=name;
 return state;
}
export async function readIsolatedCommerce(shopId:string,shopName:string){
 const row=await prisma.shopCommerce.findUnique({where:{shopId}});
 if(!row)return {state:newShopState(shopName),version:0,initialized:false};
 return {state:normalizeState(row.data as unknown as State),version:row.version,initialized:true};
}
export async function initializeIsolatedCommerce(shopId:string,shopName:string){
 const state=newShopState(shopName);
 const record=await prisma.shopCommerce.upsert({
  where:{shopId},
  create:{shopId,data:state as unknown as Prisma.InputJsonValue},
  update:{},
  select:{version:true}
 });
 return {version:record.version};
}
