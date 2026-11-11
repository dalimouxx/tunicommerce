import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../../modules/auth/session';
import {prisma} from '../../../modules/storage/client';
import {shopSlotsForOwner} from '../../../modules/shops/plan-limits';
import {HttpError} from '../../../modules/auth/http';
import CreateShopForm from './create-shop-form';
import styles from '../shops.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Créer une boutique · Tunicom',robots:{index:false,follow:false}};
export default async function NewShopPage(){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');
 const organizations=await prisma.organization.findMany({where:{ownerId:actor.userId},select:{id:true,name:true},orderBy:{createdAt:'asc'}});
 let capacity:{used:number;limit:number|null;plan:string}|null=null,error='';
 try{capacity=await shopSlotsForOwner(actor.userId,prisma);}catch(cause){if(!(cause instanceof HttpError))throw cause;error=cause.message;}
 const blocked=!!error||!!capacity&&capacity.limit!==null&&capacity.used>=capacity.limit;
 return <main className={styles.shell}><div className={styles.content}>
  <header className={styles.header}><div><span className={styles.eyebrow}>UN NOUVEAU PROJET</span><h1>Ta prochaine boutique commence ici.</h1><p>Un nouvel univers, son catalogue et ses commandes. Tu restes aux commandes de chaque boutique.</p></div><Link href="/mes-boutiques" className={styles.back}>Mes boutiques</Link></header>
  <div className={styles.creationLayout}><section className={styles.card}>
   <h2>Poser les bases</h2><p>La boutique sera créée en brouillon. Tu décideras de sa publication après avoir préparé ton catalogue.</p>
   {capacity&&<p className={styles.quotaNotice}>{capacity.used} boutique(s) utilisée(s){capacity.limit===null?' · Sans plafond':` sur ${capacity.limit}`}. Les brouillons sont compris dans ce total.</p>}
   {blocked?<div role="status"><h3>Création actuellement indisponible</h3><p>{error||'Le nombre de boutiques autorisé par ton offre est atteint.'}</p><Link href="/mon-abonnement" className={styles.secondary}>Voir mon abonnement</Link></div>:
    <CreateShopForm organizations={organizations} defaultGroupName="Mes boutiques"/>}
  </section><aside className={styles.creationAside}><span className={styles.kicker}>TON PARCOURS</span><h2>Une idée. Une boutique. Ton rythme.</h2><ol><li>Choisis son nom et son lien.</li><li>Ajoute les produits et le stock.</li><li>Choisis un thème et prépare ta vitrine.</li><li>Prévisualise, puis publie avec un abonnement valide.</li></ol><p>Chaque boutique conserve ses propres données. Aucun catalogue existant n'est copié ou remplacé.</p></aside></div>
 </div></main>;
}
