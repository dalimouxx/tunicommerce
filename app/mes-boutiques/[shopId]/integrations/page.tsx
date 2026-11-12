import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {readWebhookSettings} from '../../../../modules/messaging/webhook-service';
import WebhookSettings from '../../../../components/webhook-settings';
import styles from '../../../../components/shop-pages.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Connexions de ma boutique · Tunicom',robots:{index:false,follow:false}};
export default async function Integrations({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');
 const {shopId}=await params;
 const data=await readWebhookSettings(actor.userId,shopId).catch(()=>null);if(!data)notFound();
 return <main className={styles.shell}><Link href={'/mes-boutiques/'+encodeURIComponent(shopId)}>← {data.shopName}</Link>
  <WebhookSettings shopId={shopId} initial={data}/></main>;
}
