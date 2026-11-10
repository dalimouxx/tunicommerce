import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ShieldCheck,Store,Users,Globe,Layers,Settings2,Receipt,Activity,ArrowLeftRight,CircleDollarSign,Banknote,Landmark} from 'lucide-react';
import {getSuperAdminUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import styles from './platform.module.css';
import PortalLogout from '../../components/portal-logout';
import AppNavLink from '../../components/app-nav-link';

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
    <span className={styles.logoIcon}>t.</span>
    <span>Tunicom<small>Centre de contrôle SaaS</small></span>
   </Link>
   <div className={styles.sectionLabel}>PILOTAGE PLATEFORME</div>
   <nav className={styles.navigation} aria-label="Administration globale">
    <AppNavLink href="/admin" activeClassName={styles.active}><ShieldCheck size={18}/> Vue d’ensemble</AppNavLink>
    <AppNavLink href="/admin/marchands" activeClassName={styles.active}><Users size={18}/> Marchands</AppNavLink>
    <AppNavLink href="/admin/gestion-boutiques" activeClassName={styles.active}><Store size={18}/> Boutiques</AppNavLink>
    <AppNavLink href="/admin/abonnements" activeClassName={styles.active}><Receipt size={18}/> Abonnements</AppNavLink>
    <AppNavLink href="/admin/paiements" activeClassName={styles.active}><Banknote size={18}/> Règlements SaaS</AppNavLink>
    <AppNavLink href="/admin/finances-saas" activeClassName={styles.active}><CircleDollarSign size={18}/> Finance et échéances SaaS</AppNavLink>
    <AppNavLink href="/admin/integrations" activeClassName={styles.active}><Settings2 size={18}/> Intégrations externes</AppNavLink>
    <AppNavLink href="/admin/taches" activeClassName={styles.active}><Activity size={18}/> Tâches en arrière-plan</AppNavLink>
    <AppNavLink href="/admin/coordonnees-paiement" activeClassName={styles.active}><Landmark size={18}/> Coordonnées de paiement</AppNavLink>
    <AppNavLink href="/admin/plans" activeClassName={styles.active}><CircleDollarSign size={18}/> Offres et quotas</AppNavLink>
    <AppNavLink href="/admin/journal" activeClassName={styles.active}><Activity size={18}/> Journal d’activité</AppNavLink>
    <AppNavLink href="/admin/fiabilite" activeClassName={styles.active}><ShieldCheck size={18}/> Fiabilité et contrôles</AppNavLink>
    <AppNavLink href="/admin/lancement" activeClassName={styles.active}><ShieldCheck size={18}/> Préparation au lancement</AppNavLink>
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
    <span className={styles.breadcrumb}>Tunicom / <strong>Administration globale</strong></span>
    <span className={styles.security}><ShieldCheck size={15}/> Accès plateforme sécurisé</span>
   </header>
   <div className={styles.content}>{children}</div>
  </main>
 </div>;
}
