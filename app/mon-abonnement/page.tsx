import Link from 'next/link';
import {redirect} from 'next/navigation';
import {CalendarClock,Package,ShoppingCart,Images,ShieldCheck,ArrowLeft} from 'lucide-react';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import {normalizeState} from '../../modules/commerce/normalize';
import type {State} from '../../modules/commerce/types';
import {loadWorkspaceQuotas} from '../../modules/subscriptions/quotas';
import {subscriptionLabel} from '../../modules/platform/admin-overview';
import {countMerchantShopSlots} from '../../modules/shops/plan-limits';
import {countStaffSeats} from '../../modules/shops/member-limits';
import {effectiveLimit} from '../../modules/subscriptions/validation';
import {quotaOverview} from '../../modules/subscriptions/overview';
import {ownerCommerceBillingSummary} from '../../modules/shops/merchant-billing-summary';
import {enabledReceptionMethods} from '../../modules/billing/reception';
import styles from './plan.module.css';
import SubscriptionBilling,{type PaymentHistory,type PaymentOffer} from './subscription-billing';
import SubscriptionReminders from '../../components/subscription-reminders';
import {readSubscriptionReminders} from '../../modules/billing/reminders';

export const dynamic='force-dynamic';

function capacity(used:number,cap:number|null){
 return cap===null?'Sans limite':used+' / '+cap;
}
export default async function MySubscription(){
 const user=await getCurrentUser();
 if(!user)redirect('/connexion/boutique');
 const workspace=await prisma.workspace.findUnique({where:{ownerId:user.userId}});
 if(!workspace)redirect(user.role==='ADMIN'?'/admin':'/equipe');
 const reminders=await readSubscriptionReminders(user.userId);
 const [plan,quotas,photos,availablePlans,payments,methods,shopCount,staffMemberships,linkedShop,isolatedStates]=await Promise.all([
  prisma.subscriptionPlan.findUnique({where:{code:workspace.plan}}),
  loadWorkspaceQuotas(workspace),
  prisma.productMedia.count({where:{workspaceId:workspace.id}}),
  prisma.subscriptionPlan.findMany({
   where:{enabled:true,priceMillimes:{gt:0}},
   select:{code:true,name:true,description:true,priceMillimes:true,durationDays:true},
   orderBy:{code:'asc'}
  }),
  prisma.subscriptionPayment.findMany({
   where:{workspaceId:workspace.id},orderBy:{createdAt:'desc'},take:60,
   select:{
    id:true,reference:true,planName:true,planCode:true,priceMillimes:true,durationDays:true,
    method:true,transferReference:true,status:true,merchantNote:true,adminNote:true,
    periodStartsAt:true,periodEndsAt:true,createdAt:true,decidedAt:true
   }
  }),
  enabledReceptionMethods(),
  prisma.shop.count({where:{organization:{ownerId:user.userId}}}),
  prisma.membership.findMany({where:{active:true,shop:{organization:{ownerId:user.userId}}},select:{userId:true}}),
  prisma.shop.findUnique({where:{legacyWorkspaceId:workspace.id},select:{id:true}}),
  prisma.shopCommerce.findMany({where:{shop:{organization:{ownerId:user.userId}}},select:{data:true}})
 ]);
 const commerceStates=[normalizeState(workspace.data as unknown as State),
  ...isolatedStates.map(row=>normalizeState(row.data as unknown as State))];
 const summary=ownerCommerceBillingSummary(commerceStates,quotas,
  {status:workspace.subscriptionStatus,endsAt:workspace.subscriptionEndsAt});
 const used=[
  {name:'Produits · toutes boutiques',amount:summary.products.used,cap:quotas.maxProducts,Icon:Package},
  {name:'Commandes du mois · toutes boutiques',amount:summary.orders.used,cap:quotas.maxOrdersPerMonth,Icon:ShoppingCart},
  {name:'Photos · bibliothèque historique',amount:photos,cap:quotas.maxPhotos,Icon:Images}
 ];
 const label=subscriptionLabel(workspace.subscriptionStatus,workspace.subscriptionEndsAt);
 const status=summary.subscription;
 const shops=quotaOverview(countMerchantShopSlots(shopCount,!linkedShop),effectiveLimit(plan?.maxShops??null,undefined));
 const collaborators=quotaOverview(countStaffSeats(staffMemberships.map(m=>m.userId),user.userId),effectiveLimit(plan?.maxMembers??null,undefined));
 return <main className={styles.shell}>
  <div className={styles.content}>
   <Link href="/marchand" className={styles.back}><ArrowLeft size={16}/> Retour à ma boutique</Link>
   <header className={styles.hero}>
    <div>
     <span className={styles.eyebrow}>MON COMPTE · TUNICOM</span>
     <h1>Mon abonnement</h1>
     <p>Consultez votre offre, sa validité et la consommation cumulée de toutes vos boutiques.</p>
    </div>
    <div className={styles.status}><ShieldCheck size={17}/>{label}</div>
   </header>
   <div className={styles.summary}>
    <div><small>Offre actuelle</small><strong>{plan?.name||workspace.plan}</strong><span>{workspace.plan}</span></div>
    <div><small>Tarif de référence</small><strong>{plan&&plan.priceMillimes>0?(plan.priceMillimes/1000).toFixed(3)+' TND':'Non configuré'}</strong><span>Pas de paiement automatique</span></div>
    <div><small>Durée de l'offre</small><strong>{plan?plan.durationDays+' jours':'Non définie'}</strong><span>Référence de tarification</span></div>
    <div><small>Échéance actuelle</small><strong>{workspace.subscriptionEndsAt?workspace.subscriptionEndsAt.toLocaleDateString('fr-TN'):'Non définie'}</strong><span>Gérée par l'administration</span></div>
   </div>
   {summary.attention&&<section className={styles.card}><h2>Échéance ou restriction d'abonnement</h2><p role="alert">{summary.attention}</p><a href="#declarer-reglement">Consulter les démarches de renouvellement</a></section>}
   <section className={styles.card}>
    <h2><CalendarClock size={19}/> Abonnement et capacité multi-boutique</h2>
    <p>{status.active?`Abonnement valide · ${status.daysRemaining} jour(s) restant(s)`:'Abonnement non actif ou échéance non configurée. Les droits sont contrôlés par le serveur.'}</p>
    <div className={styles.usage}>
     {[{name:'Boutiques',usage:shops},{name:'Collaborateurs distincts',usage:collaborators}].map(item=><div key={item.name}>
      <ShieldCheck size={19}/>
      <span><strong>{item.name}</strong><small>{item.usage.limit===null?`${item.usage.used} utilisés · Sans limite`:`${item.usage.used} / ${item.usage.limit} · ${item.usage.remaining} restant(s)`}</small></span>
      {item.usage.limit!==null&&<progress max={Math.max(1,item.usage.limit)} value={Math.min(item.usage.used,item.usage.limit)} aria-label={'Utilisation '+item.name}/>}
     </div>)}
    </div>
    <p>Les limites s'appliquent à l'ensemble de vos organisations. Un collaborateur présent dans plusieurs boutiques n'occupe qu'une place. Cette vue ne renouvelle pas l'abonnement.</p>
   </section>
   <section className={styles.card}>
    <h2><CalendarClock size={19}/> Consommation du compte marchand</h2>
    <div className={styles.usage}>
     {used.map(item=><div key={item.name}>
      <item.Icon size={19}/>
      <span><strong>{item.name}</strong><small>{capacity(item.amount,item.cap)}</small></span>
      {item.cap!==null&&<progress max={item.cap||1} value={Math.min(item.amount,item.cap||1)} aria-label={'Utilisation '+item.name}/>}
     </div>)}
    </div>
    <p>Les produits et commandes comprennent le commerce historique et les boutiques indépendantes du propriétaire. Les photos affichées ici concernent uniquement la bibliothèque historique. Les données existantes sont préservées si un plafond diminue.</p>
   </section>
   <div id="declarer-reglement"><SubscriptionBilling
    methods={methods}
    plans={availablePlans satisfies PaymentOffer[]}
    history={payments.map(p=>({
     ...p,
     periodStartsAt:p.periodStartsAt?.toISOString()||null,
     periodEndsAt:p.periodEndsAt?.toISOString()||null,
     createdAt:p.createdAt.toISOString(),
     decidedAt:p.decidedAt?.toISOString()||null
    })) satisfies PaymentHistory[]}
   /></div>
   <section className={styles.card}>
    <h2>Rappels d’abonnement</h2>
    <SubscriptionReminders initial={{...reminders,jobs:reminders.jobs.map(job=>({...job,createdAt:job.createdAt.toISOString(),finishedAt:job.finishedAt?.toISOString()??null}))}}/>
   </section>
   <section className={styles.card}>
    <h2>Renouvellement et contrôle</h2>
    <p>Les déclarations sont examinées par l'administration. Seule sa validation prolonge l’abonnement ; aucune carte bancaire n'est débitée automatiquement.</p>
    <Link href="/marchand" className={styles.back}>Continuer à gérer ma boutique</Link>
   </section>
  </div>
 </main>;
}
