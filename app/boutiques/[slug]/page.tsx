import {notFound} from 'next/navigation';
import {prisma} from '../../../modules/storage/client';
import {isOpen,publicCatalog} from '../../../modules/platform/public';
import {normalizeState} from '../../../modules/commerce/normalize';
import {readPresentation} from '../../../modules/appearance/validation';
import type {State} from '../../../modules/commerce/types';
import StorefrontTheme from '../../../components/storefront-theme';
import PublicShop from '../../../components/public-shop';

export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const row=await prisma.workspace.findUnique({where:{slug}});
 if(!row||!isOpen(row))notFound();
 const state=normalizeState(row.data as unknown as State);
 return <StorefrontTheme appearance={readPresentation(state)}>
  <PublicShop slug={slug} catalog={publicCatalog(state)}/>
 </StorefrontTheme>;
}
