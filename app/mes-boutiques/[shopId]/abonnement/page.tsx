import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {prisma} from '../../../../modules/storage/client';
import {requireIsolatedOwner} from '../../../../modules/shops/isolated-commerce';
import {normalizeState} from '../../../../modules/commerce/normalize';
import type {State} from '../../../../modules/commerce/types';
import {loadWorkspaceQuotas} from '../../../../modules/subscriptions/quotas';
import {subscriptionOverview} from '../../../../modules/subscriptions/overview';
import {merchantQuotaUsage} from '../../../../modules/shops/billing-usage';
import styles from '../../shops.module.css';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};

export default async function MerchantSubscriptionUsage({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();
 if(!actor)redirect('/connexion/boutique');
 const {shopId}=await params;
 const shop=await requireIsolatedOwner(actor.userId,shopId).catch(()=>null);
 if(!shop)notFound();
 const metadata=await prisma.shop.findUnique({where:{id:shopId},
  select:{organization:{select:{ownerId:true}}}});
 // Subscription data belongs to the organization billing owner, never to arbitrary shop staff.
 if(!metadata||metadata.organization.ownerId!==actor.userId)notFound();
 const [workspace,shopStates]=await Promise.all([
  prisma.workspace.findUnique({where:{ownerId:actor.userId},select:{
   id:true,plan:true,subscriptionStatus:true,subscriptionEndsAt:true,data:true
  }}),
  prisma.shopCommerce.findMany({where:{shop:{organization:{ownerId:actor.userId}}},select:{data:true}})
 ]);
 if(!workspace)notFound();
 const [plan,quotas]=await Promise.all([
  prisma.subscriptionPlan.findUnique({where:{code:workspace.plan},
   select:{name:true,enabled:true,priceMillimes:true,durationDays:true}}),
  loadWorkspaceQuotas(workspace)
 ]);
 const states=[
  normalizeState(workspace.data as unknown as State),
  ...shopStates.map(row=>normalizeState(row.data as unknown as State))
 ];
 const usage=merchantQuotaUsage(states,quotas);
 const subscription=subscriptionOverview(workspace.subscriptionStatus,workspace.subscriptionEndsAt);
 return <main className={styles.shell}><div className={styles.content}>
  <header className={styles.header}><div>
   <span className={styles.eyebrow}>MON COMPTE SaaS · QUOTAS PARTAGÉS</span>
   <h1>Abonnement et consommation</h1>
   <p>Boutique : {shop.name}. Ces limites concernent l'ensemble des boutiques appartenant à ce compte, y compris le commerce historique s'il existe.</p>
  </div><Link className={styles.back} href={'/mes-boutiques/'+encodeURIComponent(shopId)}>Retour à ma boutique</Link></header>
  <section className={styles.card}>
   <h2>Formule {plan?.name||workspace.plan}</h2>
   <p>Statut : <strong>{workspace.subscriptionStatus}</strong> · {subscription.active?'Abonnement valide':'Abonnement non valide pour créer de nouvelles ventes'}</p>
   <p>Échéance : {subscription.expiresAt?new Date(subscription.expiresAt).toLocaleDateString('fr-TN'):'Non renseignée'}</p>
   <p>Prix catalogue : {plan?(plan.priceMillimes/1000).toFixed(3)+' TND / '+plan.durationDays+' jours':'Tarif indisponible'}. Ce tarif n'est pas une preuve de paiement.</p>
   {!plan?.enabled&&<p role="alert">Cette offre est absente ou désactivée : contactez l'administration avant toute nouvelle activité.</p>}
   <p>Le renouvellement n'est pas automatique depuis cette page. Consultez l'espace abonnement pour les démarches disponibles.</p>
   <Link href="/mon-abonnement">Voir mes demandes et paiements d’abonnement</Link>
  </section>
  <div className={styles.grid}>
   {([
    {label:'Produits · toutes boutiques',data:usage.products},
    {label:'Commandes du mois · heure de Tunisie',data:usage.orders}
   ] as const).map(item=><section className={styles.card} key={item.label}>
    <span className={styles.kicker}>{item.label}</span>
    <h2>{item.data.used} / {item.data.limit===null?'Illimité':item.data.limit}</h2>
    <p>{item.data.limit===null?'Aucun plafond configuré dans cette offre.':
     item.data.atLimit?'Plafond atteint.':item.data.nearLimit?'Vous approchez du plafond.':
     item.data.remaining+' disponibles dans votre offre.'}</p>
   </section>)}
  </div>
  <section className={styles.card}>
   <h2>Comprendre les plafonds</h2>
   <p>Un produit présent dans une boutique compte pour un produit. Les commandes mensuelles sont regroupées par mois civil en Tunisie et additionnées entre toutes les boutiques du propriétaire.</p>
   <p>Les remboursements, retours et changements de statut restent enregistrés dans l'historique. Cette page est un rapport informatif : elle n'active aucun abonnement et ne modifie pas les limites.</p>
  </section>
 </div></main>;
}
