import Link from 'next/link';
import {prisma} from '../../../modules/storage/client';
import {billingBucket,billingBuckets} from '../../../modules/platform/saas-billing-health';
import {toTnd} from '../../../modules/billing/validation';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';

export default async function SaasBillingCommandCenter(){
 const now=new Date();
 const since=new Date(now.getTime()-30*86400000);
 const [accounts,approved30d,pending,approvedAll,latest]=await Promise.all([
  prisma.workspace.findMany({
   select:{id:true,plan:true,subscriptionStatus:true,subscriptionEndsAt:true,
    owner:{select:{name:true,email:true}},shop:{select:{id:true}}},
   orderBy:{updatedAt:'desc'},take:2000
  }),
  prisma.subscriptionPayment.aggregate({where:{status:'APPROVED',decidedAt:{gte:since}},_count:{_all:true},_sum:{priceMillimes:true}}),
  prisma.subscriptionPayment.aggregate({where:{status:'PENDING'},_count:{_all:true},_sum:{priceMillimes:true}}),
  prisma.subscriptionPayment.aggregate({where:{status:'APPROVED'},_count:{_all:true},_sum:{priceMillimes:true}}),
  prisma.subscriptionPayment.findMany({where:{status:'APPROVED'},orderBy:{decidedAt:'desc'},take:20,
   select:{id:true,reference:true,planCode:true,priceMillimes:true,decidedAt:true,
    workspace:{select:{owner:{select:{name:true,email:true}}}}}})
 ]);
 const buckets=billingBuckets(accounts.map(row=>({status:row.subscriptionStatus,endsAt:row.subscriptionEndsAt})),now);
 const attention=accounts.filter(row=>['DUE_SOON','EXPIRED'].includes(billingBucket({
  status:row.subscriptionStatus,endsAt:row.subscriptionEndsAt
 },now))).sort((a,b)=>(a.subscriptionEndsAt?.getTime()||0)-(b.subscriptionEndsAt?.getTime()||0)).slice(0,50);
 return <div>
  <div className={styles.head}><div><span className={styles.eyebrow}>SUPERVISION FINANCIÈRE · SAAS</span>
   <h1>Centre financier des abonnements</h1>
   <p>Montants des demandes approuvées administrativement et des déclarations en attente. Aucun rapprochement bancaire automatique, aucune reconnaissance fiscale du chiffre d'affaires.</p>
  </div></div>
  <div className={styles.metricsInline}>
   <Link href="/admin/paiements" className={styles.secondary}>Vérifier les règlements</Link>
   <Link href="/admin/abonnements" className={styles.secondary}>Gérer les échéances</Link>
   <Link href="/api/admin/subscription-payments/export?status=APPROVED" className={styles.secondary}>Exporter les décisions (CSV)</Link>
  </div>
  <div className={styles.stats}>
   {([
    ['Paiements approuvés · 30 jours',toTnd(approved30d._sum.priceMillimes||0),approved30d._count._all+' dossier(s)'],
    ['Demandes en attente',toTnd(pending._sum.priceMillimes||0),pending._count._all+' déclaration(s) · non encaissées'],
    ['Paiements approuvés · historique',toTnd(approvedAll._sum.priceMillimes||0),approvedAll._count._all+' dossier(s)'],
    ['Échéances sous 7 jours',String(buckets.DUE_SOON),'Abonnements actifs ou en essai'],
    ['Abonnements expirés',String(buckets.EXPIRED),'Accès de croissance restreint'],
    ['Abonnements suspendus',String(buckets.SUSPENDED),'Suspendus ou résiliés']
   ] as const).map(([label,value,detail])=><section className={styles.stat} key={label}>
    <span>{label}</span><strong>{value}</strong><small>{detail}</small>
   </section>)}
  </div>
  <section className={styles.panel}>
   <div className={styles.panelHead}><div><h2>File de suivi des renouvellements</h2>
    <p>Comptes nécessitant une action : expiration passée ou dans les sept jours. Aucun e-mail n'est envoyé automatiquement.</p></div></div>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Marchand</th><th>Offre</th><th>Statut</th><th>Échéance</th><th>Action</th></tr></thead>
    <tbody>{attention.map(row=><tr key={row.id}>
     <td><strong>{row.owner.name}</strong><small>{row.owner.email}</small></td>
     <td>{row.plan}</td><td>{billingBucket({status:row.subscriptionStatus,endsAt:row.subscriptionEndsAt},now)==='EXPIRED'?'Expiré':'Échéance proche'}</td>
     <td>{row.subscriptionEndsAt?.toLocaleDateString('fr-TN')||'Non configurée'}</td>
     <td><Link href={'/admin/gestion-boutiques?shop='+encodeURIComponent(row.id)}>Vérifier le compte</Link></td>
    </tr>)}</tbody>
   </table></div>
   {!attention.length&&<p>Aucune échéance à traiter dans les comptes examinés.</p>}
   <p>Liste des 50 premières échéances parmi les 2 000 derniers comptes chargés. Les chiffres ne constituent pas une comptabilité bancaire.</p>
  </section>
  <section className={styles.panel}>
   <div className={styles.panelHead}><div><h2>Derniers règlements approuvés</h2>
    <p>Validations par les administrateurs, à recouper avec les justificatifs externes.</p></div></div>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Référence</th><th>Marchand</th><th>Offre</th><th>Montant</th><th>Validation</th></tr></thead>
    <tbody>{latest.map(item=><tr key={item.id}>
     <td>{item.reference}</td><td>{item.workspace.owner.name}</td><td>{item.planCode}</td>
     <td>{toTnd(item.priceMillimes)}</td><td>{item.decidedAt?.toLocaleDateString('fr-TN')||'Non renseignée'}</td>
    </tr>)}</tbody>
   </table></div>
  </section>
 </div>;
}
