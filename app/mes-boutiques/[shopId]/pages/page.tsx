import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {listShopPages} from '../../../../modules/shops/page-service';
import ShopPageEditor from '../../../../components/shop-page-editor';
import styles from '../../../../components/shop-pages.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Pages de ma boutique · Tunicom',robots:{index:false,follow:false}};
export default async function Pages({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');
 const {shopId}=await params;const data=await listShopPages(actor.userId,shopId).catch(()=>null);if(!data)notFound();
 return <main className={styles.shell}><Link href={'/mes-boutiques/'+encodeURIComponent(shopId)}>← {data.shop.name}</Link>
  <ShopPageEditor shopId={shopId} shopSlug={data.shop.slug} initialPages={data.pages}/></main>;
}
