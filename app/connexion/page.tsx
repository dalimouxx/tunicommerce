import Link from 'next/link';
import {ShieldCheck,Store,ArrowRight,LockKeyhole} from 'lucide-react';
import styles from './portal-choice.module.css';

export const metadata={title:'Choisir mon espace · Tunicom',robots:{index:false,follow:false}};

/** Portal entrypoints are different authentication contexts and cookie sessions.
 * This choice page never attempts to authenticate a user or expose account lists.
 */
export default function PortalChoice(){
 return <main className={styles.shell}>
  <div className={styles.wrap}>
   <header className={styles.heading}>
    <span className={styles.eyebrow}>TUNICOM · ACCÈS SÉPARÉS</span>
    <h1>Quel espace souhaitez-vous ouvrir ?</h1>
    <p>Le Super Admin supervise la plateforme SaaS. Le marchand administre uniquement ses boutiques. Chaque espace utilise sa propre page de connexion et sa propre session.</p>
   </header>
   <div className={styles.options}>
    <section className={styles.portal}>
     <div className={styles.icon}><ShieldCheck size={28}/></div>
     <p className={styles.overline}>ADMINISTRATION DE LA PLATEFORME</p>
     <h2>Super Admin</h2>
     <p>Gestion globale des marchands, boutiques, abonnements, offres, facturation SaaS, intégrations et sécurité.</p>
     <Link className={styles.primary} href="/connexion/admin">Connexion Super Admin <ArrowRight size={17}/></Link>
     <small><LockKeyhole size={14}/> Session réservée au rôle administrateur de la plateforme.</small>
    </section>
    <section className={styles.portal}>
     <div className={styles.icon}><Store size={28}/></div>
     <p className={styles.overline}>GESTION PERSONNELLE DES COMMERCES</p>
     <h2>Admin Boutique</h2>
     <p>Produits, commandes, clients, stocks, Call Center, livraison, finances, thèmes et personnalisation de ses propres boutiques.</p>
     <Link className={styles.primary} href="/connexion/boutique">Connexion Admin Boutique <ArrowRight size={17}/></Link>
     <small><LockKeyhole size={14}/> Session indépendante de l'administration globale.</small>
    </section>
   </div>
   <footer className={styles.footer}>
    <Link href="/inscription">Créer une boutique</Link>
    <Link href="/boutiques">Visiter les boutiques publiques</Link>
   </footer>
  </div>
 </main>;
}
