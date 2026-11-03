import Link from 'next/link';
import {notFound} from 'next/navigation';
import {prisma} from '../../../../../modules/storage/client';
import {normalizeState} from '../../../../../modules/commerce/normalize';
import type {State} from '../../../../../modules/commerce/types';
import {publicTrackingView} from '../../../../../modules/shops/order-fulfillment';
import styles from '../../../../mes-boutiques/shops.module.css';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};

export default async function CustomerOrderTracking({params}:{params:Promise<{slug:string;token:string}>}){
 const {slug,token}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))notFound();
 const shop=await prisma.shop.findUnique({where:{slug},select:{
  name:true,legacyWorkspaceId:true,commerce:{select:{data:true}}
 }});
 // A valid bearer link remains readable after the merchant unpublishes the catalog.
 if(!shop||shop.legacyWorkspaceId!==null||!shop.commerce)notFound();
 const order=publicTrackingView(normalizeState(shop.commerce.data as unknown as State),token);
 if(!order)notFound();
 return <main className={styles.shell}><div className={styles.content}>
  <header className={styles.header}>
   <div><span className={styles.eyebrow}>SUIVI PRIVÉ DE COMMANDE</span>
    <h1>Commande {order.reference}</h1>
    <p>Statut actuel : <strong>{order.statusLabel}</strong></p>
   </div>
   <Link href={'/vitrines/'+encodeURIComponent(slug)} className={styles.back}>Catalogue de la boutique</Link>
  </header>
  <section className={styles.card}>
   <h2>Suivi de votre commande</h2>
   <p>Commande reçue le {new Date(order.createdAt).toLocaleDateString('fr-TN')}. Dernière mise à jour le {new Date(order.updatedAt).toLocaleDateString('fr-TN')}.</p>
   <p>Montant enregistré : <strong>{(order.totalMillimes/1000).toFixed(3)} TND</strong> · paiement à la livraison.</p>
   <ul>{order.items.map((item,index)=><li key={index}>{item.name}{item.variant?' · '+item.variant:''} × {item.quantity}</li>)}</ul>
   {order.carrier&&<p>Transporteur déclaré : {order.carrier}</p>}
   {order.tracking&&<p>Référence de transport : {order.tracking}</p>}
   <p>Le statut est mis à jour par la boutique. Pour consulter les dernières modifications, actualisez cette page.</p>
   <p>Conservez ce lien confidentiel : toute personne le possédant peut consulter le statut de la commande.</p>
  </section>
 </div></main>;
}
