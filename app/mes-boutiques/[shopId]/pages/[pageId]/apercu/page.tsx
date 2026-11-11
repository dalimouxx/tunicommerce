import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {pageOwner,pageStorefrontPath} from '../../../../../../modules/shops/page-service';
import {pageContent} from '../../../../../../modules/shops/page-content';
import {prisma} from '../../../../../../modules/storage/client';
import ShopPageContent from '../../../../../../components/shop-page-content';
export const dynamic='force-dynamic';
export const metadata={title:'Aperçu privé de page',robots:{index:false,follow:false}};
export default async function Preview({params}:{params:Promise<{shopId:string;pageId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');
 const {shopId,pageId}=await params;
 const shop=await pageOwner(actor.userId,shopId).catch(()=>null);if(!shop)notFound();
 const row=await prisma.shopPage.findFirst({where:{id:pageId,shopId},select:{draft:true}});if(!row)notFound();
 const content=pageContent.safeParse(row.draft);if(!content.success)notFound();
 return <><div style={{padding:16,textAlign:'center'}}><Link href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/pages'}>← Retour à l’éditeur</Link></div>
  <ShopPageContent content={content.data} shopName={shop.name} slug={shop.slug} storefrontPath={pageStorefrontPath(shop)||'/mes-boutiques/'+encodeURIComponent(shopId)+'/accueil/apercu'} preview/></>;
}
