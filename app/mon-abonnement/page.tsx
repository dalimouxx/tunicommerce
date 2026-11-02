import Link from 'next/link';
import {redirect} from 'next/navigation';
import {CalendarClock,Package,ShoppingCart,Images,ShieldCheck,ArrowLeft} from 'lucide-react';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import {normalizeState} from '../../modules/commerce/normalize';
import type {State} from '../../modules/commerce/types';
import {loadWorkspaceQuotas} from '../../modules/subscriptions/quotas';
import {subscriptionLabel} from '../../modules/platform/admin-overview';
import styles from './plan.module.css';

export const dynamic='force-dynamic';

function tunisiaMonth(date:Date){
 return new Intl.DateTimeFormat('en-CA',{
  timeZone:'Africa/Tunis',year:'numeric',month:'2-digit'
 }).format(date);
}
function capacity(used:number,cap:number|null){
 return cap===null?'Sans limite':used+' / '+cap;
}
export default async function MySubscription(){
 const user=await getCurrentUser();
 if(!user)redirect('/login');
 const workspace=await prisma.workspace.findUnique({where:{ownerId:user.userId}});
 if(!workspace)redirect(user.role==='ADMIN'?'/admin':'/equipe');
 const [plan,quotas,photos]=await Promise.all([
  prisma.subscriptionPlan.findUnique({where:{code:workspace.plan}}),
  loadWorkspaceQuotas(workspace),
  prisma.productMedia.count({where:{workspaceId:workspace.id}})
 ]);
 const data=normalizeState(workspace.data as unknown as State);
 const month=tunisiaMonth(new Date());
 const monthlyOrders=data.orders.filter(o=>tunisiaMonth(new Date(o.createdAt))===month).length;
 const used=[
  {name:'Produits',amount:data.products.length,cap:quotas.maxProducts,Icon:Package},
  {name:'Commandes du mois',amount:monthlyOrders,cap:quotas.maxOrdersPerMonth,Icon:ShoppingCart},
  {name:'Photos produits',amount:photos,cap:quotas.maxPhotos,Icon:Images}
 ];
 const label=subscriptionLabel(workspace.subscriptionStatus,workspace.subscriptionEndsAt);
 return <main className={styles.shell}>
  <div className={styles.content}>
   <Link href="/marchand" className={styles.back}><ArrowLeft size={16}/> Retour à ma boutique</Link>
   <header className={styles.hero}>
    <div>
     <span className={styles.eyebrow}>MON COMPTE · TUNICOMMERCE</span>
     <h1>Mon abonnement</h1>
     <p>Consultez votre offre, sa validité et les limites réellement appliquées à votre boutique.</p>
    </div>
    <div className={styles.status}><ShieldCheck size={17}/>{label}</div>
   </header>
   <div className={styles.summary}>
    <div><small>Offre actuelle</small><strong>{plan?.name||workspace.plan}</strong><span>{workspace.plan}</span></div>
    <div><small>Tarif de référence</small><strong>{plan&&plan.priceMillimes>0?(plan.priceMillimes/1000).toFixed(3)+' TND':'Non configuré'}</strong><span>Pas de paiement automatique</span></div>
    <div><small>Durée de l'offre</small><strong>{plan?plan.durationDays+' jours':'Non définie'}</strong><span>Référence de tarification</span></div>
    <div><small>Échéance actuelle</small><strong>{workspace.subscriptionEndsAt?workspace.subscriptionEndsAt.toLocaleDateString('fr-TN'):'Non définie'}</strong><span>Gérée par l'administration</span></div>
   </div>
   <section className={styles.card}>
    <h2><CalendarClock size={19}/> Utilisation de votre boutique</h2>
    <div className={styles.usage}>
     {used.map(item=><div key={item.name}>
      <item.Icon size={19}/>
      <span><strong>{item.name}</strong><small>{capacity(item.amount,item.cap)}</small></span>
      {item.cap!==null&&<progress max={item.cap||1} value={Math.min(item.amount,item.cap||1)} aria-label={'Utilisation '+item.name}/>}
     </div>)}
    </div>
    <p>Les nouvelles créations sont limitées selon l'offre. Les produits, commandes et fichiers déjà enregistrés sont conservés si un plafond diminue.</p>
   </section>
   <section className={styles.card}>
    <h2>Évolution de votre offre</h2>
    <p>La modification ou le renouvellement d’un abonnement est actuellement réalisé manuellement par l’administrateur TuniCommerce. Aucune carte bancaire n'est débitée automatiquement.</p>
    <Link href="/marchand" className={styles.back}>Continuer à gérer ma boutique</Link>
   </section>
  </div>
 </main>;
}
