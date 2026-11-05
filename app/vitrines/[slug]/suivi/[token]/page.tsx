import Link from 'next/link';
import CustomerRequestForm from './customer-request-form';
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
   <p>{order.progress.note}</p>
   {order.progress.steps.length>0&&<ol aria-label="Progression de la commande"
    style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10,padding:0,listStyle:'none',margin:'16px 0'}}>
    {order.progress.steps.map(step=><li key={step.id}
     aria-current={step.state==='CURRENT'?'step':undefined}
     style={{border:'1px solid '+(step.state==='CURRENT'?'#126c65':'#dce5eb'),
      borderRadius:12,padding:12,background:step.state==='CURRENT'?'#edf9f6':'#fff'}}>
     <strong>{step.label}</strong>
     <span style={{display:'block',fontSize:13,marginTop:5}}>
      {step.state==='DONE'?'Étape déclarée accomplie':step.state==='CURRENT'?'Statut actuel':'À venir'}
     </span>
    </li>)}
   </ol>}
   <p>Commande reçue le {new Date(order.createdAt).toLocaleDateString('fr-TN')}. Dernière mise à jour le {new Date(order.updatedAt).toLocaleDateString('fr-TN')}.</p>
   <p>Montant enregistré : <strong>{(order.totalMillimes/1000).toFixed(3)} TND</strong> · paiement à la livraison.</p>
   <ul>{order.items.map((item,index)=><li key={index}>{item.name}{item.variant?' · '+item.variant:''} × {item.quantity}</li>)}</ul>
   {order.carrier&&<p>Transporteur déclaré : {order.carrier}</p>}
   {order.tracking&&<p>Référence de transport : {order.tracking}</p>}
   <p>Le statut est mis à jour par la boutique. Pour consulter les dernières modifications, actualisez cette page.</p>
   <p>Conservez ce lien confidentiel : toute personne le possédant peut consulter le statut de la commande.</p>
  </section>
  <section className={styles.card}>
   <h2>Mes demandes</h2>
   {order.requests.length===0?<p>Aucune demande envoyée pour cette commande.</p>:
    <ul>{order.requests.map(request=><li key={request.id}>
     {request.type==='CANCEL'?'Annulation':'Retour'} · {request.status==='PENDING'?'En attente':request.status==='ACCEPTED'?'Acceptée':'Refusée'}
     · {new Date(request.at).toLocaleDateString('fr-TN')} {request.reply&&<span>· Réponse du marchand : {request.reply}</span>}
    </li>)}</ul>}
   <p>Le traitement d’une demande reste manuel : les statuts de livraison, stocks et encaissements ne changent pas automatiquement.</p>
  </section>
  <CustomerRequestForm slug={slug} token={token} canCancel={order.canCancel} canReturn={order.canReturn}/>
 </div></main>;
}
