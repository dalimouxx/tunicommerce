import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../modules/auth/session';
import {prisma} from '../../../modules/storage/client';
import {normalizeState} from '../../../modules/commerce/normalize';
import {money,type State} from '../../../modules/commerce/types';
import {commercialOverview,mayReadOwnCommercialOverview} from '../../../modules/shops/commercial-overview';
import styles from '../shops.module.css';

export const dynamic='force-dynamic';

export default async function MerchantShopOverview({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();
 if(!actor)redirect('/login');
 const {shopId}=await params;
 const membership=await prisma.membership.findUnique({
  where:{shopId_userId:{shopId,userId:actor.userId}},
  select:{active:true,role:true,shop:{
   select:{name:true,slug:true,status:true,legacyWorkspaceId:true,
    organization:{select:{name:true}},
    legacyWorkspace:{select:{ownerId:true,data:true}}
   }
  }}
 });
 if(!membership?.active)notFound();
 const shop=membership.shop;
 const workspace=shop.legacyWorkspace;
 const canRead=mayReadOwnCommercialOverview({
  active:membership.active,role:membership.role,
  workspaceOwnerId:workspace?.ownerId??null,userId:actor.userId
 });
 // Fail closed: do not deserialize commercial data for unprivileged team members.
 const summary=canRead&&workspace?commercialOverview(normalizeState(workspace.data as unknown as State)):null;
 const cards=summary?[
  ['Produits',String(summary.products)],
  ['Unités en stock',String(summary.stockUnits)],
  ['Commandes',String(summary.orders)],
  ['À confirmer',String(summary.pendingConfirmation)],
  ['Commandes livrées',String(summary.delivered)],
  ['Clients',String(summary.customers)],
  ['Ventes livrées brutes',money(summary.deliveredGrossMillimes)+' TND'],
  ['COD non encaissé',money(summary.codOutstandingMillimes)+' TND']
 ]:[];
 return <main className={styles.shell}>
  <div className={styles.content}>
   <header className={styles.header}>
    <div><span className={styles.eyebrow}>BOUTIQUE · {shop.organization.name}</span>
     <h1>{shop.name}</h1><p>Statut : {shop.status} · Votre rôle : {membership.role}</p></div>
    <Link className={styles.back} href="/mes-boutiques">Toutes mes boutiques</Link>
   </header>
   {summary?<><div className={styles.grid}>{cards.map(([name,value])=>
    <section key={name} className={styles.card}><span className={styles.kicker}>{name}</span><h2>{value}</h2></section>
   )}</div><section className={styles.card}><h2>Gestion commerciale</h2>
    <p>Ces statistiques concernent uniquement la boutique liée à votre espace personnel. Les informations des acheteurs ne sont pas affichées sur cette page.</p>
    <div className={styles.actions}><Link className={styles.primary} href="/marchand">Accéder à ma gestion</Link>
    <Link className={styles.secondary} href="/mon-abonnement">Mon abonnement</Link></div>
   </section></>:
   <section className={styles.card}><h2>Vue commerciale indisponible</h2>
    <p>{workspace?'Seul le propriétaire commercial lié peut consulter ces chiffres.':'Cette boutique n’est pas encore reliée à un espace commercial indépendant.'} Votre appartenance à l’équipe ne donne pas accès aux commandes d’un autre marchand.</p>
    <Link href="/equipe" className={styles.secondary}>Équipe et permissions</Link>
   </section>}
  </div>
 </main>;
}
