import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {ArrowUpRight,Store,Package,ShoppingBag,Users,Wallet,ShieldCheck,Clock,ExternalLink,Link2Off} from 'lucide-react';
import {getSuperAdminUser} from '../../../../modules/auth/session';
import {prisma} from '../../../../modules/storage/client';
import {normalizeState} from '../../../../modules/commerce/normalize';
import {money,type State} from '../../../../modules/commerce/types';
import {isOpen} from '../../../../modules/platform/public';
import {legacyShopName,subscriptionAttention,subscriptionLabel} from '../../../../modules/platform/admin-overview';
import styles from '../../platform.module.css';
import PlanOverrideEditor from '../../../../components/plan-override-editor';

export const dynamic='force-dynamic';

export default async function AdminShopDetails({params}:{params:Promise<{id:string}>}){
 const user=await getSuperAdminUser();
 if(!user)redirect('/connexion/admin');
 if(user.role!=='ADMIN')redirect('/marchand');
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const row=await prisma.workspace.findUnique({
  where:{id},include:{
   owner:{select:{id:true,name:true,email:true,role:true,createdAt:true}},
   shop:{select:{id:true,status:true,organization:{select:{name:true}}}},
   _count:{select:{media:true,productMedia:true}}
  }
 });
 if(!row)notFound();
 const state=normalizeState(row.data as unknown as State);
 const products=state.products||[];
 const orders=state.orders||[];
 const customers=state.customers||[];
 const activeProducts=products.filter(p=>p.active);
 const pending=orders.filter(o=>['TO_CONFIRM','CALLBACK','NO_ANSWER'].includes(o.status)).length;
 const delivered=orders.filter(o=>o.status==='DELIVERED');
 const deliveredGross=delivered.reduce((sum,o)=>sum+o.total,0);
 const collected=delivered.reduce((sum,o)=>sum+o.collected,0);
 const open=isOpen(row);
 const risk=subscriptionAttention(row.subscriptionStatus,row.subscriptionEndsAt);
 const audit=await prisma.platformAudit.findMany({
  where:{workspaceId:row.id},orderBy:{createdAt:'desc'},take:20,
  select:{id:true,createdAt:true,detail:true}
 });
 const [plan,override]=await Promise.all([
  prisma.subscriptionPlan.findUnique({
   where:{code:row.plan},select:{maxProducts:true,maxOrdersPerMonth:true,maxPhotos:true}
  }),
  prisma.workspacePlanOverride.findUnique({where:{workspaceId:row.id},
   select:{maxProducts:true,maxOrdersPerMonth:true,maxPhotos:true,note:true}})
 ]);
 const shopName=legacyShopName(row.data);
 return <>
  <div className={styles.head}>
   <div><span className={styles.eyebrow}>SUPERVISION / FICHE BOUTIQUE</span>
    <h1>{shopName}</h1>
    <p>Informations administratives et indicateurs agrégés de cette boutique. Les données personnelles des acheteurs ne sont pas affichées ici.</p>
   </div>
   <Link href={'/admin/gestion-boutiques?shop='+row.id} className={styles.primary}>Configurer l’abonnement <ArrowUpRight size={16}/></Link>
  </div>
  <div className={styles.detailsToolbar}>
   <Link href="/admin">← Tableau de bord global</Link>
   {row.slug&&open&&<Link href={'/boutiques/'+row.slug} target="_blank">Ouvrir la boutique publique <ExternalLink size={15}/></Link>}
  </div>
  <div className={styles.stats}>
   <div className={styles.stat}><span><Package size={17}/> Produits actifs</span><strong>{activeProducts.length}</strong><small>{products.length} produits au catalogue</small></div>
   <div className={styles.stat}><span><ShoppingBag size={17}/> Commandes</span><strong>{orders.length}</strong><small>{pending} en attente de confirmation</small></div>
   <div className={styles.stat}><span><Users size={17}/> Clients</span><strong>{customers.length}</strong><small>Fiches enregistrées dans cet espace</small></div>
   <div className={styles.stat}><span><Wallet size={17}/> Ventes livrées brutes</span><strong>{money(deliveredGross)}</strong><small>TND · COD encaissé : {money(collected)} TND</small></div>
  </div>
  <div className={styles.detailGrid}>
   <section className={styles.panel}>
    <div className={styles.panelHead}><div><h2><Store size={18}/> Identité de la boutique</h2><p>Données du marchand et statut de publication</p></div></div>
    <dl className={styles.detailList}>
     <dt>Nom du propriétaire</dt><dd>{row.owner.name}</dd>
     <dt>E-mail</dt><dd>{row.owner.email}</dd>
     <dt>Type de compte</dt><dd>{row.owner.role==='ADMIN'?'Compte plateforme':'Marchand'}</dd>
     <dt>Compte créé le</dt><dd>{row.owner.createdAt.toLocaleDateString('fr-TN')}</dd>
     <dt>URL publique</dt><dd>{row.slug?'/boutiques/'+row.slug:'À configurer'}</dd>
     <dt>Statut public</dt><dd><span className={open?styles.success:styles.waiting}>{open?'Accessible':row.published?'Publiée mais inaccessible':'Brouillon'}</span></dd>
     <dt>Structure d’équipe</dt><dd>{row.shop?'Reliée · '+row.shop.organization.name:'À relier'}</dd>
     <dt>Visuels de marque</dt><dd>{row._count.media}</dd>
     <dt>Photos produits stockées</dt><dd>{row._count.productMedia}</dd>
     <dt>Dernière modification</dt><dd>{row.updatedAt.toLocaleString('fr-TN')}</dd>
    </dl>
   </section>
   <section className={styles.panel}>
    <div className={styles.panelHead}><div><h2><ShieldCheck size={18}/> Offre et accès</h2><p>La publication reste contrôlée par le statut et la date d'abonnement</p></div></div>
    <dl className={styles.detailList}>
     <dt>Formule</dt><dd><strong>{row.plan}</strong></dd>
     <dt>Statut de l’abonnement</dt><dd>{subscriptionLabel(row.subscriptionStatus,row.subscriptionEndsAt)}</dd>
     <dt>Échéance</dt><dd>{row.subscriptionEndsAt?row.subscriptionEndsAt.toLocaleDateString('fr-TN'):'Non définie'}</dd>
     <dt>État de renouvellement</dt><dd>{risk==='ok'?'Aucune alerte':risk==='expiring'?'Échéance sous 7 jours':risk==='expired'?'Date dépassée':'Accès suspendu ou résilié'}</dd>
     <dt>Publication demandée</dt><dd>{row.published?'Oui':'Non'}</dd>
     <dt>Statut SaaS</dt><dd>Paiements et renouvellements manuels</dd>
    </dl>
    {!row.shop&&<div className={styles.inlineWarning}><Link2Off size={17}/> Cette boutique n’est pas encore liée à une organisation. Vous pouvez créer la liaison depuis sa fiche de gestion.</div>}
    <div className={styles.detailActions}>
     <Link href={'/admin/gestion-boutiques?shop='+row.id} className={styles.primary}>Modifier le plan et les dates <ArrowUpRight size={15}/></Link>
    </div>
   </section>
  </div>
  <div style={{marginBottom:21}}>
   <PlanOverrideEditor workspaceId={row.id} planCode={row.plan} plan={plan} override={override}/>
  </div>
  <section className={styles.panel}>
   <div className={styles.panelHead}><div><h2><Clock size={18}/> Journal administratif de cette boutique</h2><p>Changements effectués depuis la console globale</p></div>
    <Link href="/admin/journal" className={styles.secondary}>Journal complet <ArrowUpRight size={14}/></Link>
   </div>
   <div className={styles.auditList}>
    {audit.map(e=><div key={e.id} className={styles.auditItem}>
     <time>{e.createdAt.toLocaleString('fr-TN')}</time>
     <span>{e.detail.length>300?e.detail.slice(0,300)+'…':e.detail}</span>
    </div>)}
    {!audit.length&&<p className={styles.mutedEmpty}>Aucune modification administrative enregistrée pour cette boutique.</p>}
   </div>
  </section>
 </>;
}
