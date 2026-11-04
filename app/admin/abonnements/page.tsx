import {CalendarClock,Receipt,ShieldAlert} from 'lucide-react';
import Link from 'next/link';
import {loadPlatformStats,loadShopRows} from '../../../modules/platform/admin-overview';
import AdminSubscriptions from '../../../components/admin-subscriptions';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';
export default async function Abonnements({
 searchParams
}:{searchParams:Promise<{statut?:string}>}){
 const [stats,shops,{statut}]=await Promise.all([loadPlatformStats(),loadShopRows(200),searchParams]);
 return <>
  <div className={styles.head}>
   <div><span className={styles.eyebrow}>OFFRES · ESSAIS · RENOUVELLEMENTS</span>
    <h1>Gestion des abonnements</h1>
    <p>Contrôlez les abonnements et anticipez les expirations. Les prix, paiements et limites de chaque plan ne sont pas encore automatisés.</p>
   </div>
  </div>
  <div className={styles.metricsInline}>
   <Link href="/admin/plans" className={styles.secondary}>Configurer les prix, durées et quotas des offres →</Link>
   <Link href="/admin/paiements" className={styles.secondary}>Vérifier les règlements D17 et virements →</Link>
   <span>Les formules sont configurables, mais la facturation reste manuelle.</span>
  </div>
  <div className={styles.stats}>
   <div className={styles.stat}><span><Receipt size={17}/> Espaces suivis</span><strong>{stats.workspaces}</strong><small>Toutes les boutiques historiques</small></div>
   <div className={styles.stat}><span><CalendarClock size={17}/> Échéances proches</span><strong>{stats.expiring}</strong><small>Dans les 7 prochains jours</small></div>
   <div className={styles.stat}><span><ShieldAlert size={17}/> Abonnements expirés</span><strong>{stats.expired}</strong><small>Essai ou abonnement au-delà de sa date</small></div>
   <div className={styles.stat}><span><Receipt size={17}/> Boutiques publiques</span><strong>{stats.publicShops}</strong><small>Publiées avec abonnement valide</small></div>
  </div>
  <div className={styles.metricsInline}><Link href="/admin/abonnements/complet" className={styles.primary}>Voir tous les abonnements · recherche et export paginés</Link><span>La liste rapide ci-dessous affiche au maximum 200 boutiques ; utilisez le répertoire complet pour les autres.</span></div>
  <AdminSubscriptions shops={shops} total={stats.workspaces} initialFilter={statut||'all'}/>
  <div className={styles.metricsInline}><ShieldAlert size={18}/><span><strong>Gestion manuelle :</strong> une modification d'abonnement met à jour l'accès public à la boutique ; elle ne facture pas le marchand et n'envoie pas de notifications de paiement.</span></div>
 </>;
}
