import Link from 'next/link';
import {prisma} from '../../../../modules/storage/client';
import {billingBucket} from '../../../../modules/platform/saas-billing-health';
import {DIRECTORY_PAGE_SIZE,directoryHref,directoryPage,subscriptionDirectoryQuery} from '../../../../modules/platform/subscription-directory';
import styles from '../../platform.module.css';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
type Search={statut?:string;recherche?:string;page?:string;offre?:string;jours?:string};
const statusLabels:{[key:string]:string}={
 VALID:'Valide',DUE_SOON:'Échéance sous 7 jours',
 EXPIRED:'Expiré',SUSPENDED:'Suspendu ou résilié'
};
export default async function FullSubscriptionDirectory({searchParams}:{searchParams:Promise<Search>}){
 const now=new Date();
 const query=subscriptionDirectoryQuery(await searchParams,now);
 const [count,plans]=await Promise.all([
  prisma.workspace.count({where:query.where}),
  prisma.subscriptionPlan.findMany({select:{code:true,name:true},orderBy:{code:'asc'}})
 ]);
 const paging=directoryPage(query.page,count);
 const rows=await prisma.workspace.findMany({
  where:query.where,
  orderBy:[{subscriptionEndsAt:'asc'},{id:'asc'}],
  skip:(paging.page-1)*DIRECTORY_PAGE_SIZE,take:DIRECTORY_PAGE_SIZE,
  select:{
   id:true,slug:true,plan:true,subscriptionStatus:true,subscriptionEndsAt:true,
   owner:{select:{name:true,email:true}},
   shop:{select:{name:true}}
  }
 });
 const url=(path:string,page:number)=>directoryHref(path,query,page);
 return <div>
  <div className={styles.head}><div>
   <span className={styles.eyebrow}>ADMINISTRATION GLOBALE · ABONNEMENTS</span>
   <h1>Tous les abonnements</h1>
   <p>Recherche et pagination effectuées sur PostgreSQL, sur l'ensemble des comptes. Consultation sans modification des abonnements, stocks ou commandes.</p>
  </div><Link href="/admin/abonnements" className={styles.secondary}>Retour au tableau de bord</Link></div>
  <section className={styles.panel}>
   <form action="/admin/abonnements/complet" method="get" className={styles.filters}>
    <label>Recherche <input className={styles.simpleSelect} name="recherche" maxLength={100} defaultValue={query.search} placeholder="Marchand, e-mail, slug, offre, boutique"/></label>
    <label>État <select className={styles.simpleSelect} name="statut" defaultValue={query.status}>
     <option value="all">Tous</option><option value="valid">Valides</option>
     <option value="expiring">Échéances proches</option><option value="expired">Expirés</option>
     <option value="suspended">Suspendus / résiliés</option>
    </select></label>
    <label>Offre <select className={styles.simpleSelect} name="offre" defaultValue={query.plan}>
     <option value="">Toutes les offres</option>
     {query.plan&&!plans.some(plan=>plan.code===query.plan)&&<option value={query.plan}>{query.plan} (ancienne offre)</option>}
     {plans.map(plan=><option key={plan.code} value={plan.code}>{plan.name} · {plan.code}</option>)}
    </select></label>
    <label>Horizon des échéances <select className={styles.simpleSelect} name="jours" defaultValue={String(query.windowDays)}>
     <option value="7">7 jours</option><option value="14">14 jours</option><option value="30">30 jours</option>
    </select></label>
    <button className={styles.primary} type="submit">Rechercher</button>
    <Link className={styles.secondary} href={url('/api/admin/subscriptions/export',paging.page)}>Exporter cette page (CSV)</Link>
   </form>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Boutique</th><th>Marchand</th><th>Plan</th><th>Statut</th><th>Échéance</th><th>Action</th></tr></thead>
    <tbody>{rows.map(row=>{
     const bucket=billingBucket({status:row.subscriptionStatus,endsAt:row.subscriptionEndsAt},now,query.windowDays);
     const label=bucket==='DUE_SOON'?'Échéance sous '+query.windowDays+' jours':statusLabels[bucket];
     return <tr key={row.id}>
      <td><strong>{row.shop?.name||row.slug||'Boutique sans lien'}</strong><small>{row.slug||'Slug non défini'}</small></td>
      <td>{row.owner.name}<small>{row.owner.email}</small></td>
      <td>{row.plan}</td><td>{label}</td>
      <td>{row.subscriptionEndsAt?.toLocaleDateString('fr-TN')||'Non définie'}</td>
      <td><Link className={styles.action} href={'/admin/gestion-boutiques?shop='+encodeURIComponent(row.id)}>Gérer</Link></td>
     </tr>;
    })}</tbody>
   </table></div>
   {!rows.length&&<p style={{padding:20}}>Aucun abonnement ne correspond aux critères.</p>}
   <div className={styles.metricsInline} style={{padding:20}}>
    <strong>{count} résultat(s) au total</strong>
    <span>Page {paging.page} / {paging.pages} · {DIRECTORY_PAGE_SIZE} comptes maximum par page</span>
    {paging.page>1&&<Link className={styles.secondary} href={url('/admin/abonnements/complet',paging.page-1)}>Précédente</Link>}
    {paging.page<paging.pages&&<Link className={styles.secondary} href={url('/admin/abonnements/complet',paging.page+1)}>Suivante</Link>}
   </div>
   <p style={{padding:'0 20px 20px'}}>Les échéances reflètent les statuts administratifs, pas des paiements bancaires confirmés. Les exports contiennent les coordonnées professionnelles des marchands et sont réservés aux administrateurs.</p>
  </section>
 </div>;
}
