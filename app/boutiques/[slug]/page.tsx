import {notFound} from 'next/navigation';
import {prisma} from '../../../modules/storage/client';
import {isOpen,publicCatalog} from '../../../modules/platform/public';
import {normalizeState} from '../../../modules/commerce/normalize';
import {readPresentation} from '../../../modules/appearance/validation';
import type {State} from '../../../modules/commerce/types';
import StorefrontTheme from '../../../components/storefront-theme';
import PublicShop from '../../../components/public-shop';
import {publishedWorkspacePageLinks} from '../../../modules/shops/page-service';
import {publishedWorkspaceHome} from '../../../modules/shops/home-service';

export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{lang?:string}>}){
 const {slug}=await params;
 const row=await prisma.workspace.findUnique({where:{slug},include:{shop:{select:{slug:true}}}});
 if(!row||!isOpen(row))notFound();
 const state=normalizeState(row.data as unknown as State);
 const [home,pages]=await Promise.all([publishedWorkspaceHome(row.id,row.ownerId),publishedWorkspacePageLinks(row.id,row.ownerId)]);const language=(await searchParams).lang==='ar'?'ar':'fr';
 return <StorefrontTheme appearance={readPresentation(state)} announcement={home?.[language].announcement}>
  <PublicShop slug={slug} catalog={publicCatalog(state)} home={home} language={language} homeShopSlug={row.shop?.slug} pages={pages}/>
 </StorefrontTheme>;
}

