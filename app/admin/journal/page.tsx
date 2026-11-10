import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import {Activity,ShieldCheck} from 'lucide-react';
import {prisma} from '../../../modules/storage/client';
import {legacyShopName} from '../../../modules/platform/admin-overview';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';

function describe(raw:string){
 try{
  const data=JSON.parse(raw) as Record<string,unknown>;
  const action=String(data.action||'update');
  const parts=[action==='create'?'Création':action==='update'?'Modification':action==='link'?'Liaison de boutique':action];
  if(typeof data.plan==='string')parts.push('offre '+data.plan);
  if(typeof data.subscriptionStatus==='string')parts.push('abonnement '+data.subscriptionStatus);
  if(typeof data.slug==='string')parts.push('lien '+data.slug);
  if(typeof data.published==='boolean')parts.push(data.published?'publiée':'non publiée');
  return parts.join(' · ');
 }catch{
  return raw.slice(0,180);
 }
}
export default async function GlobalAudit(){
 await requireSuperAdminPage();
 const [events,count]=await Promise.all([
  prisma.platformAudit.findMany({take:100,orderBy:{createdAt:'desc'},
   select:{id:true,actorId:true,workspaceId:true,detail:true,createdAt:true}}),
  prisma.platformAudit.count()
 ]);
 const actors=await prisma.user.findMany({
  where:{id:{in:[...new Set(events.map(e=>e.actorId))]}},
  select:{id:true,name:true,email:true}
 });
 const workspaceRows=await prisma.workspace.findMany({
  where:{id:{in:[...new Set(events.map(e=>e.workspaceId))]}},
  select:{id:true,data:true}
 });
 const byActor=new Map(actors.map(a=>[a.id,a]));
 const byShop=new Map(workspaceRows.map(w=>[w.id,legacyShopName(w.data)]));
 return <>
  <div className={styles.head}>
   <div><span className={styles.eyebrow}>TRAÇABILITÉ · PLATEFORME</span>
    <h1>Journal administratif</h1>
    <p>Historique des interventions sur les boutiques et abonnements. Les modifications du catalogue faites par les marchands restent dans leur espace privé.</p>
   </div>
  </div>
  <div className={styles.metricsInline}><Activity size={19}/><strong>{count} événement(s) administratifs</strong><span>Les 100 événements les plus récents sont affichés.</span></div>
  <section className={styles.panel}>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Date</th><th>Auteur</th><th>Boutique</th><th>Action</th></tr></thead>
    <tbody>{events.map(e=><tr key={e.id}>
     <td>{e.createdAt.toLocaleString('fr-TN')}</td>
     <td><strong>{byActor.get(e.actorId)?.name||'Compte non disponible'}</strong><small>{byActor.get(e.actorId)?.email||e.actorId}</small></td>
     <td>{byShop.get(e.workspaceId)||'Boutique supprimée ou inconnue'}</td>
     <td>{describe(e.detail)}</td>
    </tr>)}</tbody>
   </table></div>
   {!events.length&&<div className={styles.empty}><ShieldCheck size={27}/><strong>Pas encore d’activité administrative</strong></div>}
   <div className={styles.listFooter}>Ce journal contient les opérations enregistrées par les API d'administration, pas toutes les connexions ni tous les événements de sécurité.</div>
  </section>
 </>;
}
