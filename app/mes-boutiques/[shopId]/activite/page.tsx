import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {readActivity} from '../../../../modules/shops/activity-index-service';
import {activityQuery} from '../../../../modules/shops/activity-query';
import ActivityBrowser from '../../../../components/activity-browser';
import styles from '../../../../components/catalog-browser.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Commandes et clients · Tunicom',robots:{index:false,follow:false}};
export default async function Activity({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');const {shopId}=await params;
 const data=await readActivity(actor.userId,shopId,activityQuery.parse({})).catch(()=>null);if(!data)notFound();
 return <main className={styles.shell}><Link className={styles.back} href={'/mes-boutiques/'+encodeURIComponent(shopId)}>← {data.shopName}</Link><ActivityBrowser shopId={shopId} initial={data}/></main>;
}
