import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {pageOwner} from '../../../../modules/shops/page-service';
import {getShopHome} from '../../../../modules/shops/home-service';
import ShopHomeEditor from '../../../../components/shop-home-editor';
import styles from '../../../../components/shop-pages.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Composer mon accueil · Tunicom',robots:{index:false,follow:false}};
export default async function HomeEditorPage({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');const {shopId}=await params;
 const shop=await pageOwner(actor.userId,shopId).catch(()=>null);if(!shop)notFound();
 const initial=await getShopHome(actor.userId,shopId);
 return <main className={styles.shell}><Link href={'/mes-boutiques/'+shopId}>← Ma boutique</Link><ShopHomeEditor shopId={shopId} shopSlug={shop.slug} initial={initial}/></main>;
}
