import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import {isOpen} from '../../modules/platform/public';
import {shopAccess} from '../../modules/shops/navigation';
import styles from './shops.module.css';

export const dynamic='force-dynamic';

export default async function MyShops(){
 const actor=await getCurrentUser();
 if(!actor)redirect('/login');
 const [legacy, memberships]=await Promise.all([
  prisma.workspace.findUnique({
   where:{ownerId:actor.userId},
   select:{id:true,slug:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true,shop:{select:{id:true}}}
  }),
  prisma.membership.findMany({
   where:{userId:actor.userId,active:true},
   select:{
    role:true,active:true,
    shop:{select:{
     id:true,name:true,slug:true,status:true,legacyWorkspaceId:true,
     organization:{select:{name:true}},
     legacyWorkspace:{select:{slug:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true}}
    }}
   },
   orderBy:{createdAt:'desc'}
  })
 ]);
 const hasUnlinkedLegacy=legacy&&!memberships.some(m=>m.shop.legacyWorkspaceId===legacy.id);
 return <main className={styles.shell}>
  <div className={styles.content}>
   <header className={styles.header}>
    <div><span className={styles.eyebrow}>ESPACE MARCHAND</span><h1>Mes boutiques</h1>
    <p>Retrouvez les boutiques auxquelles votre compte a réellement accès. Les données de chaque marchand restent séparées.</p></div>
    <Link href={actor.role==='ADMIN'?'/admin':'/marchand'} className={styles.back}>Retour à mon espace</Link>
   </header>
   {hasUnlinkedLegacy&&<section className={styles.card}>
    <span className={styles.kicker}>Boutique personnelle existante</span>
    <h2>Ma gestion commerciale</h2>
    <p>Votre espace historique de commandes, catalogue, clients, livraison et finances est accessible avec votre propre compte.</p>
    <div className={styles.actions}><Link href="/marchand" className={styles.primary}>Gérer ma boutique</Link>
    {legacy.slug&&isOpen(legacy)&&<Link href={'/boutiques/'+encodeURIComponent(legacy.slug)} className={styles.secondary}>Voir ma vitrine</Link>}</div>
   </section>}
   {memberships.length===0&&!legacy&&<section className={styles.card}>
    <h2>Aucune boutique associée</h2>
    <p>Votre compte n'a pas encore de boutique personnelle ni de participation active. La création et l'affectation se font depuis les espaces autorisés.</p>
    <Link href={actor.role==='ADMIN'?'/admin/gestion-boutiques':'/equipe'} className={styles.secondary}>Voir les options disponibles</Link>
   </section>}
   <div className={styles.grid}>{memberships.map(({shop,role,active})=>{
    const access=shopAccess({id:shop.id,legacyWorkspaceId:shop.legacyWorkspaceId,status:shop.status,active,role},legacy?.id||null);
    const linked=shop.legacyWorkspace;
    const publicSlug=linked?.slug&&isOpen(linked)?linked.slug:null;
    return <section key={shop.id} className={styles.card}>
     <span className={styles.kicker}>{shop.organization.name}</span>
     <h2>{shop.name}</h2>
     <div className={styles.meta}><span>Rôle : {role}</span><span>Statut : {shop.status}</span></div>
     <p>{access.explanation}</p>
     <div className={styles.actions}>
      {access.manageOwnCommerce&&<Link className={styles.primary} href="/marchand">Gérer ma boutique</Link>}
      {access.mayOpenTeam&&<Link className={styles.secondary} href="/equipe">Gestion de l'équipe</Link>}
      {publicSlug&&<Link className={styles.secondary} href={'/boutiques/'+encodeURIComponent(publicSlug)}>Vitrine publique</Link>}
     </div>
    </section>;
   })}</div>
   <p className={styles.note}>Un accès équipe ne donne pas automatiquement accès à la caisse ou aux commandes d'une autre boutique. La gestion multi-boutique sera activée après mise en place des permissions et du stockage commercial par boutique.</p>
  </div>
 </main>;
}
