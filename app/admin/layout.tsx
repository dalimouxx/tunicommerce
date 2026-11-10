import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ShieldCheck,Store,Users,Globe,Layers,Settings2,Receipt,Activity,ArrowLeftRight,CircleDollarSign,Banknote,Landmark} from 'lucide-react';
import {getSuperAdminUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import styles from './platform.module.css';
import PortalLogout from '../../components/portal-logout';

export const dynamic='force-dynamic';

export default async function AdminLayout({children}:{children:React.ReactNode}){
 const actor=await getSuperAdminUser();
 if(!actor)redirect('/connexion/admin');
 if(actor.role!=='ADMIN')redirect('/marchand');
 const ownWorkspace=await prisma.workspace.findUnique({
  where:{ownerId:actor.userId},select:{id:true}
 });
 return <div className={styles.shell}>
  <aside className={styles.sidebar}>
   <Link href="/admin" className={styles.logo}>
    <span className={styles.logoIcon}><Layers size={20}/></span>
    <span>TuniCommerce<small>Centre de contrôle SaaS</small></span>
   </Link>
   <div className={styles.sectionLabel}>PILOTAGE PLATEFORME</div>
   <nav className={styles.navigation} aria-label="Administration globale">
    <Link href="/admin"><ShieldCheck size={18}/> Vue d’ensemble</Link>
    <Link href="/admin/marchands"><Users size={18}/> Marchands</Link>
    <Link href="/admin/gestion-boutiques"><Store size={18}/> Boutiques</Link>
    <Link href="/admin/abonnements"><Receipt size={18}/> Abonnements</Link>
    <Link href="/admin/paiements"><Banknote size={18}/> Règlements SaaS</Link>
    <Link href="/admin/finances-saas"><CircleDollarSign size={18}/> Finance et échéances SaaS</Link>
    <Link href="/admin/integrations"><Settings2 size={18}/> Intégrations externes</Link>
    <Link href="/admin/taches"><Activity size={18}/> Tâches en arrière-plan</Link>
    <Link href="/admin/coordonnees-paiement"><Landmark size={18}/> Coordonnées de paiement</Link>
    <Link href="/admin/plans"><CircleDollarSign size={18}/> Offres et quotas</Link>
    <Link href="/admin/journal"><Activity size={18}/> Journal d’activité</Link>
    <Link href="/admin/fiabilite"><ShieldCheck size={18}/> Fiabilité et contrôles</Link>
    <Link href="/admin/lancement"><ShieldCheck size={18}/> Préparation au lancement</Link>
    <Link href="/boutiques"><Globe size={18}/> Boutiques publiques</Link>
    <Link href="/connexion/boutique"><Store size={18}/> Espace Boutique · connexion séparée</Link>
   </nav>
   <div className={styles.sectionLabel}>MON ESPACE</div>
   <nav className={styles.navigation}>
    {ownWorkspace&&<Link href="/connexion/boutique"><ArrowLeftRight size={18}/> Ma boutique personnelle · autre connexion</Link>}
    <Link href="/admin/gestion-boutiques"><Settings2 size={18}/> Configuration des boutiques</Link>
    <Link href="/compte/securite?portail=ADMIN"><ShieldCheck size={18}/> Sécurité de mon compte</Link>
   </nav>
   <div className={styles.identity}>
    <span className={styles.identityIcon}><ShieldCheck size={19}/></span>
    <div><strong>Super-administrateur</strong><small>{actor.email}</small><PortalLogout/></div>
   </div>
  </aside>
  <main className={styles.main}>
   <header className={styles.top}>
    <span className={styles.breadcrumb}>TuniCommerce / <strong>Administration globale</strong></span>
    <span className={styles.security}><ShieldCheck size={15}/> Accès plateforme sécurisé</span>
   </header>
   <div className={styles.content}>{children}</div>
  </main>
 </div>;
}
