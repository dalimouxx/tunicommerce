import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {HttpError} from '../auth/http';
import {readPresentation,type AppearanceInput} from './validation';

export async function getStoreAppearance(ownerId:string){
 const workspace=await prisma.workspace.findUnique({
  where:{ownerId},select:{slug:true,published:true,data:true}
 });
 if(!workspace)throw new HttpError(404,'Boutique introuvable');
 const state=normalizeState(workspace.data as unknown as State);
 return {
  appearance:readPresentation(state),
  logoUrl:state.shop.logoUrl||'',
  bannerUrl:state.shop.bannerUrl||'',
  description:state.shop.description||'',
  shopName:state.shop.name,
  slug:workspace.slug,
  published:workspace.published
 };
}

/**
 * Persist visual preferences in the already existing merchant workspace.
 * No database migration, no changes to products/orders/customers, no global theme state.
 */
export async function saveStoreAppearance(ownerId:string,input:AppearanceInput){
 return prisma.$transaction(async tx=>{
  const workspace=await tx.workspace.findUnique({where:{ownerId}});
  if(!workspace)throw new HttpError(404,'Boutique introuvable');
  const state=normalizeState(workspace.data as unknown as State);
  const next={
   ...state,
   appearance:{
    theme:input.theme,accent:input.accent,eyebrow:input.eyebrow,tagline:input.tagline
   },
   shop:{
    ...state.shop,
    logoUrl:input.logoUrl,
    bannerUrl:input.bannerUrl,
    description:input.description
   }
  };
  const result=await tx.workspace.updateMany({
   where:{id:workspace.id,version:workspace.version},
   data:{
    data:next as unknown as Prisma.InputJsonValue,
    version:{increment:1}
   }
  });
  if(result.count!==1)throw new HttpError(409,'Modifications simultanées. Actualisez et réessayez.');
  return {
   saved:true,
   appearance:readPresentation(next),
   logoUrl:next.shop.logoUrl,
   bannerUrl:next.shop.bannerUrl,
   description:next.shop.description
  };
 });
}
