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
import type {Metadata} from 'next';
import {storefrontSeo} from '../../../modules/seo/canonical';
import {absoluteUrl} from '../../../modules/seo/urls';
import {jsonLdScript,storeJsonLd} from '../../../modules/seo/structured-data';

export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 const row=await prisma.workspace.findUnique({where:{slug},select:{id:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true,data:true,shop:{select:{id:true}}}});
 if(!row||!isOpen(row))return {title:'Boutique indisponible',robots:{index:false,follow:false}};
 const catalog=publicCatalog(normalizeState(row.data as unknown as State));
 const title=(catalog.name||slug).slice(0,120);
 const description=(catalog.description||'Boutique tunisienne · paiement à la livraison').slice(0,160);
 const seo=await storefrontSeo(row.shop?.id,'/boutiques/'+encodeURIComponent(slug),'/');
 const image=absoluteUrl(seo.origin,catalog.bannerUrl||catalog.logoUrl||catalog.products.find(product=>product.imageUrl)?.imageUrl||'');
 return {title,description,robots:{index:!catalog.demo,follow:true},alternates:seo.alternates,
  openGraph:{title,description,type:'website',url:seo.url,siteName:title,locale:'fr_TN',...(image?{images:[{url:image,alt:title}]}:{})},
  twitter:{card:image?'summary_large_image':'summary',title,description,...(image?{images:[image]}:{})}};
}
export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{lang?:string}>}){
 const {slug}=await params;
 const row=await prisma.workspace.findUnique({where:{slug},include:{shop:{select:{slug:true,id:true}}}});
 if(!row||!isOpen(row))notFound();
 const state=normalizeState(row.data as unknown as State);
 const [home,pages]=await Promise.all([publishedWorkspaceHome(row.id,row.ownerId),publishedWorkspacePageLinks(row.id,row.ownerId)]);const language=(await searchParams).lang==='ar'?'ar':'fr';
 const catalog=publicCatalog(state),seo=await storefrontSeo(row.shop?.id,'/boutiques/'+encodeURIComponent(slug),'/');
 return <StorefrontTheme appearance={readPresentation(state)} announcement={home?.[language].announcement}>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(storeJsonLd({name:catalog.name,description:catalog.description,url:seo.url,logoUrl:catalog.logoUrl,origin:seo.origin}))}}/>
  <PublicShop slug={slug} catalog={catalog} home={home} language={language} homeShopSlug={row.shop?.slug} pages={pages}/>
 </StorefrontTheme>;
}

