import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {cache} from 'react';
import {readPublicShopPage} from '../../../../../modules/shops/page-service';
import ShopPageContent from '../../../../../components/shop-page-content';
const read=cache(readPublicShopPage);
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string;pageSlug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug,pageSlug}=await params,page=await read(slug,pageSlug);
 return page?{title:page.content.title+' · '+page.shopName,description:page.content.description}:
  {title:'Page indisponible',robots:{index:false,follow:false}};
}
export default async function PublicPage({params}:Props){
 const {slug,pageSlug}=await params,page=await read(slug,pageSlug);if(!page)notFound();
 return <ShopPageContent content={page.content} shopName={page.shopName} slug={slug}/>;
}
