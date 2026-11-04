import Link from 'next/link';
import {notFound} from 'next/navigation';
import {prisma} from '../../../../modules/storage/client';
import {requireAdmin} from '../../../../modules/platform/admin';
import {merchantDossierSummary} from '../../../../modules/platform/merchant-dossier';
import {subscriptionOverview} from '../../../../modules/subscriptions/overview';
import {toTnd,paymentStatusLabel} from '../../../../modules/billing/validation';
import styles from '../../platform.module.css';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};

export default async function GlobalMerchantDossier({params}:{params:Promise<{ownerId:string}>}){
 await requireAdmin();
 const {ownerId}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId))notFound();
 // Parent admin layout requires a global ADMIN session.
 const merchant=await prisma.user.findUnique({where:{id:ownerId},
  select:{name:true,email:true,role:true,createdAt:true,
   workspace:{select:{id:true,plan:true,subscriptionStatus:true,subscriptionEndsAt:true}}}});
 if(!merchant||merchant.role!=='MERCHANT')notFound();
 const [organizations,memberships,payments,approved,pending]=await Promise.all([
  prisma.organization.findMany({where:{ownerId},orderBy:{createdAt:'asc'},
   select:{id:true,name:true,shops:{select:{id:true,name:true,slug:true,status:true,
    legacyWorkspaceId:true,commerce:{select:{shopId:true}}},orderBy:{createdAt:'desc'}}}}),
  prisma.membership.findMany({where:{active:true,shop:{organization:{ownerId}}},
   select:{userId:true,active:true,shopId:true}}),
  merchant.workspace?prisma.subscriptionPayment.findMany({where:{workspaceId:merchant.workspace.id},
   orderBy:{createdAt:'desc'},take:20,select:{id:true,reference:true,planName:true,priceMillimes:true,
    method:true,status:true,createdAt:true,decidedAt:true}}):Promise.resolve([]),
  merchant.workspace?prisma.subscriptionPayment.aggregate({where:{workspaceId:merchant.workspace.id,status:'APPROVED'},
   _count:{_all:true},_sum:{priceMillimes:true}}):Promise.resolve(null),
  merchant.workspace?prisma.subscriptionPayment.aggregate({where:{workspaceId:merchant.workspace.id,status:'PENDING'},
   _count:{_all:true},_sum:{priceMillimes:true}}):Promise.resolve(null)
 ]);
 const shops=organizations.flatMap(org=>org.shops);
 const stats=merchantDossierSummary(shops.map(s=>({
  id:s.id,status:s.status,legacyWorkspaceId:s.legacyWorkspaceId,initialized:!!s.commerce
 })),memberships,ownerId);
 const access=merchant.workspace?subscriptionOverview(merchant.workspace.subscriptionStatus,merchant.workspace.subscriptionEndsAt):null;
 return <div>
  <div className={styles.head}>
   <div><span className={styles.eyebrow}>ADMINISTRATION GLOBALE · DOSSIER MARCHAND</span>
    <h1>{merchant.name}</h1><p>{merchant.email} · Compte créé le {merchant.createdAt.toLocaleDateString('fr-TN')}</p></div>
   <Link href="/admin/marchands" className={styles.secondary}>Retour aux marchands</Link>
  </div>
  <div className={styles.stats}>
   {([
    ['Organisations',organizations.length],['Boutiques',stats.shops],
    ['Boutiques indépendantes',stats.independent],['Boutiques historiques reliées',stats.legacyLinked],
    ['Collaborateurs distincts',stats.distinctStaff],['Boutiques avec statut publié',stats.publishedFlag]
   ] as const).map(([label,value])=><section className={styles.stat} key={label}>
    <span>{label}</span><strong>{value}</strong>
   </section>)}
  </div>
  <section className={styles.panel}>
   <div className={styles.panelHead}><div><h2>Abonnement commun au propriétaire</h2>
    <p>Les changements d'offre ou de statut concernent toutes les boutiques du même compte.</p></div></div>
   {merchant.workspace?<div style={{padding:16}}>
    <p>Offre : <strong>{merchant.workspace.plan}</strong> · Statut : <strong>{merchant.workspace.subscriptionStatus}</strong></p>
    <p>Échéance : {merchant.workspace.subscriptionEndsAt?.toLocaleDateString('fr-TN')||'Non définie'} · {access?.active?'Valide':'Non valide pour de nouvelles ventes'}</p>
    <p>Règlements approuvés administrativement : <strong>{approved?toTnd(approved._sum.priceMillimes||0):'0 TND'}</strong> ({approved?approved._count._all:0} dossier(s)).</p>
    <p>Déclarations en attente (non encaissées) : <strong>{pending?toTnd(pending._sum.priceMillimes||0):'0 TND'}</strong> ({pending?pending._count._all:0} demande(s)).</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
     <Link href={'/admin/gestion-boutiques?shop='+merchant.workspace.id}>Gérer la configuration du compte</Link>
     <Link href="/admin/paiements">Vérifier les règlements</Link>
     <Link href="/admin/boutiques-independantes">Superviser les nouvelles boutiques</Link>
    </div>
   </div>:<p style={{padding:16}}>Aucun Workspace de facturation : créez un compte marchand depuis l'administration. Aucune demande de paiement ne peut être attribuée ici.</p>}
  </section>
  <section className={styles.panel}>
   <div className={styles.panelHead}><div><h2>Organisations et boutiques</h2>
    <p>Vue de supervision uniquement : les commandes et les coordonnées des acheteurs ne sont jamais affichées.</p></div></div>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Organisation</th><th>Boutique</th><th>Statut</th><th>Stockage</th><th>Membres actifs</th></tr></thead>
    <tbody>{organizations.flatMap(org=>org.shops.map(shop=><tr key={shop.id}>
     <td>{org.name}</td><td><strong>{shop.name}</strong><small>{shop.slug}</small></td>
     <td>{shop.status}</td><td>{shop.legacyWorkspaceId?'Liée au commerce historique':shop.commerce?'Commerce indépendant initialisé':'À initialiser'}</td>
     <td>{memberships.filter(m=>m.shopId===shop.id).length}</td>
    </tr>))}</tbody>
   </table></div>
   {shops.length===0&&<p>Aucune boutique associée à ce propriétaire.</p>}
  </section>
  <section className={styles.panel}>
   <div className={styles.panelHead}><div><h2>Dernières demandes de règlement</h2>
    <p>Historique administratif ; les validations ne prouvent pas à elles seules le rapprochement bancaire.</p></div></div>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Référence</th><th>Offre</th><th>Montant</th><th>Canal</th><th>Décision</th></tr></thead>
    <tbody>{payments.map(p=><tr key={p.id}>
     <td>{p.reference}</td><td>{p.planName}</td><td>{toTnd(p.priceMillimes)}</td>
     <td>{p.method}</td><td>{paymentStatusLabel(p.status)}</td>
    </tr>)}</tbody>
   </table></div>
   {!payments.length&&<p>Aucune demande enregistrée pour ce compte.</p>}
  </section>
 </div>;
}
