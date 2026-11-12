import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {readCatalog} from '../../../../modules/shops/catalog-index-service';
import {catalogQuery} from '../../../../modules/shops/catalog-query';
import CatalogBrowser from '../../../../components/catalog-browser';
import styles from '../../../../components/catalog-browser.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Mon catalogue · Tunicom',robots:{index:false,follow:false}};
export default async function Catalog({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');
 const {shopId}=await params;
 const data=await readCatalog(actor.userId,shopId,catalogQuery.parse({})).catch(()=>null);if(!data)notFound();
 return <main className={styles.shell}><Link className={styles.back} href={'/mes-boutiques/'+encodeURIComponent(shopId)}>← {data.shopName}</Link>
  <CatalogBrowser shopId={shopId} initial={data}/></main>;
}
