import {requireSuperAdminPage} from '../../modules/auth/page-access';
import Link from 'next/link';
import {Users,Store,Globe,Layers,ArrowUpRight,Clock,Link2Off,Activity,Receipt,Plus,ShieldCheck,Settings2,Banknote} from 'lucide-react';
import {prisma} from '../../modules/storage/client';
import {loadPlatformStats,loadShopRows} from '../../modules/platform/admin-overview';
import AdminShopExplorer from '../../components/admin-shop-explorer';
import styles from './platform.module.css';

export const dynamic='force-dynamic';

export default async function GlobalAdministration(){
 await requireSuperAdminPage();
 const [stats,shops,events,pendingPayments]=await Promise.all([
  loadPlatformStats(),
  loadShopRows(120),
  prisma.platformAudit.findMany({orderBy:{createdAt:'desc'},take:5,select:{id:true,createdAt:true,detail:true}}),
  prisma.subscriptionPayment.count({where:{status:'PENDING'}})
 ]);
 return <>
  <div className={styles.head}>
   <div>
    <span className={styles.eyebrow}>CENTRE DE CONTRÔLE · TUNICOM</span>
    <h1>Vue globale de la plateforme</h1>
    <p>Supervisez les comptes marchands, les boutiques, les abonnements et les événements administratifs. Votre boutique personnelle dispose de son propre espace indépendant.</p>
   </div>
   <Link href="/admin/gestion-boutiques" className={styles.primary}><Plus size={18}/> Ajouter un marchand</Link>
  </div>
  <div className={styles.stats}>
   <Link href="/admin/marchands" className={styles.stat}><span><Users size={17}/> Marchands enregistrés</span><strong>{stats.merchants}</strong><small>Comptes commerçants, hors administrateurs</small></Link>
   <Link href="/admin/gestion-boutiques" className={styles.stat}><span><Store size={17}/> Espaces commerciaux</span><strong>{stats.workspaces}</strong><small>{stats.relationalShops} boutiques dans la nouvelle structure</small></Link>
   <Link href="/admin/abonnements" className={styles.stat}><span><Globe size={17}/> Boutiques accessibles</span><strong>{stats.publicShops}</strong><small>Publiées et avec abonnement valide</small></Link>
   <Link href="/admin/marchands" className={styles.stat}><span><Layers size={17}/> Organisations</span><strong>{stats.organizations}</strong><small>Structures multi-boutique enregistrées</small></Link>
  </div>
  <div className={styles.signalGrid}>
   <Link href="/admin/paiements" className={styles.signal}>
    <Banknote size={19}/>
    <span><strong>{pendingPayments} règlement(s) SaaS à vérifier</strong><small>Validation humaine D17, virement ou espèces</small></span>
    <ArrowUpRight size={15}/>
   </Link>
   <Link href="/admin/abonnements?statut=expiring" className={styles.signal}>
    <Clock size={19}/>
    <span><strong>{stats.expiring} échéance(s) dans les 7 jours</strong><small>Essais et abonnements à renouveler</small></span>
    <ArrowUpRight size={15}/>
   </Link>
   <Link href="/admin/abonnements?statut=expired" className={styles.signal}>
    <Receipt size={19}/>
    <span><strong>{stats.expired} abonnement(s) expiré(s)</strong><small>Essais ou offres actives dont la date est passée</small></span>
    <ArrowUpRight size={15}/>
   </Link>
   <Link href="/admin/gestion-boutiques?filtre=unlinked" className={styles.signal}>
    <Link2Off size={19}/>
    <span><strong>{stats.unlinked} espace(s) à relier</strong><small>Organisation et rôles de l’équipe non reliés</small></span>
    <ArrowUpRight size={15}/>
   </Link>
  </div>
  <AdminShopExplorer shops={shops} allCount={stats.workspaces}/>
  <div className={styles.infoGrid}>
   <Link href="/admin/gestion-boutiques" className={styles.infoCard}>
    <Settings2 size={22}/><strong>Gestion centrale</strong>
    <span>Créer et configurer les marchands, boutiques, abonnements et publications.</span>
    <ArrowUpRight size={17}/>
   </Link>
   <div className={styles.infoCard}>
    <Activity size={22}/>
    <strong>Dernières opérations globales</strong>
    <span>{events.length} opération(s) récente(s) enregistrée(s)</span>
    {events.slice(0,3).map(e=><span key={e.id}>{new Date(e.createdAt).toLocaleString('fr-TN')} · {e.detail.slice(0,75)}</span>)}
    <Link href="/admin/journal" className={styles.action}>Consulter le journal <ArrowUpRight size={14}/></Link>
   </div>
   <Link href="/admin/abonnements" className={styles.infoCard}>
    <Receipt size={22}/><strong>Pilotage des abonnements</strong>
    <span>Visualiser les échéances et configurer les offres actuellement gérées manuellement.</span>
    <ArrowUpRight size={17}/>
   </Link>
   <Link href="/admin/lancement" className={styles.infoCard}>
    <ShieldCheck size={22}/><strong>Préparation au lancement commercial</strong>
    <span>Vérifier les sept validations et les dépendances externes avant toute ouverture commerciale.</span>
    <ArrowUpRight size={17}/>
   </Link>
   <div className={styles.infoCard}>
    <ShieldCheck size={22}/><strong>Sécurité des espaces</strong>
    <span>Les actions globales sont réservées aux super-administrateurs. Les commandes et les données commerciales restent propres à chaque boutique.</span>
    <span className={styles.tag}>Paiements SaaS automatisés : pas encore disponibles</span>
   </div>
  </div>
 </>;
}
