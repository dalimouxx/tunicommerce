import Link from 'next/link';
import PortalLogout from '../../components/portal-logout';
import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import {isOpen} from '../../modules/platform/public';
import {isPublicIsolatedShop} from '../../modules/shops/publication';
import {shopAccess} from '../../modules/shops/navigation';
import {countMerchantShopSlots} from '../../modules/shops/plan-limits';
import {effectiveLimit} from '../../modules/subscriptions/validation';
import {quotaOverview,subscriptionOverview} from '../../modules/subscriptions/overview';
import styles from './shops.module.css';

export const dynamic='force-dynamic';

export default async function MyShops(){
 const actor=await getCurrentUser();
 if(!actor)redirect('/connexion/boutique');
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
     organization:{select:{name:true,owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}},
     commerce:{select:{shopId:true}},
     legacyWorkspace:{select:{slug:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true}}
    }}
   },
   orderBy:{createdAt:'desc'}
  })
 ]);
 const linkedLegacyShop=legacy?await prisma.shop.findUnique({where:{legacyWorkspaceId:legacy.id},select:{id:true}}):null;
 const hasUnlinkedLegacy=!!legacy&&!linkedLegacyShop;
 // Owner-wide quotas must include shops from every organization, even if an
 // unusual historic membership is missing; staff-only accounts see no owner quotas.
 const ownerWorkspace=legacy?await prisma.workspace.findUnique({where:{id:legacy.id},select:{plan:true,subscriptionStatus:true,subscriptionEndsAt:true}}):null;
 const [ownedShopCount,ownerPlan]=ownerWorkspace?await Promise.all([
  prisma.shop.count({where:{organization:{ownerId:actor.userId}}}),
  prisma.subscriptionPlan.findUnique({where:{code:ownerWorkspace.plan},select:{name:true,maxShops:true}})
 ]):[null,null];
 const capacity=ownerWorkspace&&ownedShopCount!==null?quotaOverview(
  countMerchantShopSlots(ownedShopCount,hasUnlinkedLegacy),
  effectiveLimit(ownerPlan?.maxShops??null,undefined)
 ):null;
 const subscription=ownerWorkspace?subscriptionOverview(ownerWorkspace.subscriptionStatus,ownerWorkspace.subscriptionEndsAt):null;
 return <main className={styles.shell}>
  <div className={styles.content}>
   <header className={styles.header}>
    <div><span className={styles.eyebrow}>ESPACE MARCHAND</span><h1>Mes boutiques</h1>
    <p>Retrouvez les boutiques auxquelles votre compte a réellement accès. Les données de chaque marchand restent séparées.</p></div>
    <div><Link href="/marchand" className={styles.back}>Retour à mon espace</Link>{(legacy||actor.role==='ADMIN')&&<Link href="/mes-boutiques/nouvelle" className={styles.primary}>Créer une boutique ↗</Link>}<PortalLogout portal="MERCHANT"/></div>
   </header>
   {capacity&&subscription&&<section className={styles.card}>
    <span className={styles.kicker}>CAPACITÉ DE VOTRE ABONNEMENT</span>
    <h2>{ownerPlan?.name||ownerWorkspace?.plan||'Offre marchand'} · {capacity.used} boutique(s){capacity.limit===null?' · Sans limite':` / ${capacity.limit}`}</h2>
    <p>{subscription.active?`Abonnement valide · ${subscription.daysRemaining} jour(s) restant(s)`:'Abonnement non actif ou échéance non configurée.'} Les boutiques de toutes vos organisations sont comptabilisées, même en brouillon. Les boutiques existantes restent accessibles selon vos permissions.</p>
    <div className={styles.actions}><Link href="/mon-abonnement" className={styles.secondary}>Voir mon abonnement et mes quotas</Link>
     <Link href="/compte/securite" className={styles.secondary}>Sécurité de mon compte</Link></div>
   </section>}
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
    <Link href={actor.role==='ADMIN'?'/connexion/admin':'/equipe'} className={styles.secondary}>Voir les options disponibles</Link>
   </section>}
   <div className={styles.grid}>{memberships.map(({shop,role,active})=>{
    const access=shopAccess({id:shop.id,legacyWorkspaceId:shop.legacyWorkspaceId,status:shop.status,active,role},legacy?.id||null);
    const linked=shop.legacyWorkspace;
    const ownerSubscription=shop.organization.owner.workspace;
    const publicPath=linked?.slug&&isOpen(linked)?'/boutiques/'+encodeURIComponent(linked.slug):isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,subscriptionStatus:ownerSubscription?.subscriptionStatus||'',subscriptionEndsAt:ownerSubscription?.subscriptionEndsAt||null})?'/vitrines/'+encodeURIComponent(shop.slug):null;
    return <section key={shop.id} className={styles.card}>
     <span className={styles.kicker}>{shop.organization.name}</span>
     <h2>{shop.name}</h2>
     <div className={styles.meta}><span>Rôle : {role}</span><span>Statut : {shop.status}</span></div>
     <p>{access.explanation}</p>
     <div className={styles.actions}>
      {(access.manageOwnCommerce||(active&&role==='OWNER'&&shop.legacyWorkspaceId===null))&&<Link className={styles.primary} href={"/mes-boutiques/"+encodeURIComponent(shop.id)}>Tableau de bord boutique</Link>}
      {!access.manageOwnCommerce&&access.mayOpenTeam&&shop.legacyWorkspaceId===null&&<Link className={styles.primary} href={'/mes-boutiques/'+encodeURIComponent(shop.id)}>Mon espace collaborateur</Link>}
      {access.mayOpenTeam&&<Link className={styles.secondary} href="/equipe">Gestion de l'équipe</Link>}
      {publicPath&&<Link className={styles.secondary} href={publicPath}>Vitrine publique</Link>}
      {role==='OWNER'&&(access.manageOwnCommerce||!shop.legacyWorkspaceId&&shop.commerce)&&<Link className={styles.secondary} href={'/mes-boutiques/'+encodeURIComponent(shop.id)+'/accueil'}>Modifier l’accueil</Link>}
      {role==='OWNER'&&!shop.legacyWorkspaceId&&shop.commerce&&<Link className={styles.secondary} href={'/mes-boutiques/'+encodeURIComponent(shop.id)+'/apercu'}>Aperçu privé</Link>}
     </div>
    </section>;
   })}</div>
   <p className={styles.note}>L'accès aux commandes et au stock dépend du rôle attribué pour chaque boutique. Les nouveaux espaces commerciaux sont isolés et peuvent proposer une gestion différente de l'espace historique.</p>
  </div>
 </main>;
}
