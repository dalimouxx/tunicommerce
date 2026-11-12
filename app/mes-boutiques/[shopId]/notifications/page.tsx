import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {readOrderMail} from '../../../../modules/messaging/order-mail-service';
import OrderMailSettings from '../../../../components/order-mail-settings';
import styles from '../../../../components/shop-pages.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Alertes de commande · Tunicom',robots:{index:false,follow:false}};
export default async function Notifications({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');
 const {shopId}=await params;
 const data=await readOrderMail(actor.userId,shopId).catch(()=>null);if(!data)notFound();
 return <main className={styles.shell}><Link href={'/mes-boutiques/'+encodeURIComponent(shopId)}>← {data.shopName}</Link>
  <OrderMailSettings shopId={shopId} initial={JSON.parse(JSON.stringify(data))}/></main>;
}
