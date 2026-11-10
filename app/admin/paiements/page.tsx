import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import {Banknote,Clock3,CheckCheck,ShieldAlert} from 'lucide-react';
import {prisma} from '../../../modules/storage/client';
import Link from 'next/link';
import AdminPaymentQueue,{type AdminPaymentRow} from './payment-queue';
import {PAYMENT_PAGE_SIZE,paymentDirectoryHref,paymentDirectoryPage,paymentDirectoryQuery,type PaymentQueryInput} from '../../../modules/billing/payment-directory';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';

export default async function AdminSaasPayments({searchParams}:{searchParams:Promise<PaymentQueryInput>}){
 await requireSuperAdminPage();
 const query=paymentDirectoryQuery(await searchParams);
 const count=await prisma.subscriptionPayment.count({where:query.where});
 const paging=paymentDirectoryPage(query.page,count);
 const asOf=new Date().toISOString();
 const [rows,total,pending,approved]=await Promise.all([
  prisma.subscriptionPayment.findMany({
   where:query.where,orderBy:[{createdAt:'asc'},{id:'asc'}],
   skip:(paging.page-1)*PAYMENT_PAGE_SIZE,take:PAYMENT_PAGE_SIZE,
   select:{
    id:true,reference:true,workspaceId:true,planCode:true,planName:true,
    priceMillimes:true,durationDays:true,method:true,transferReference:true,
    merchantNote:true,status:true,adminNote:true,createdAt:true,decidedAt:true,
    periodStartsAt:true,periodEndsAt:true,
    workspace:{select:{slug:true,plan:true,subscriptionStatus:true,subscriptionEndsAt:true,owner:{select:{id:true,name:true,email:true}}}}
   }
  }),
  prisma.subscriptionPayment.count(),
  prisma.subscriptionPayment.count({where:{status:'PENDING'}}),
  prisma.subscriptionPayment.count({where:{status:'APPROVED'}})
 ]);
 const payments:AdminPaymentRow[]=rows.map(row=>({
  id:row.id,reference:row.reference,workspaceId:row.workspaceId,
  planCode:row.planCode,planName:row.planName,
  priceMillimes:row.priceMillimes,durationDays:row.durationDays,
  method:row.method,transferReference:row.transferReference,
  merchantNote:row.merchantNote,status:row.status,adminNote:row.adminNote,
  createdAt:row.createdAt.toISOString(),decidedAt:row.decidedAt?.toISOString()||null,
  periodEndsAt:row.periodEndsAt?.toISOString()||null,
  periodStartsAt:row.periodStartsAt?.toISOString()||null,
  currentPlan:row.workspace.plan,currentStatus:row.workspace.subscriptionStatus,
  currentEndsAt:row.workspace.subscriptionEndsAt?.toISOString()||null,
  ownerId:row.workspace.owner.id,
  slug:row.workspace.slug,ownerName:row.workspace.owner.name,
  ownerEmail:row.workspace.owner.email
 }));
 return <>
  <div className={styles.head}>
   <div>
    <span className={styles.eyebrow}>COMPTABILITÉ SAAS · VALIDATION MANUELLE</span>
    <h1>Règlements et renouvellements</h1>
    <p>Contrôlez les déclarations D17, virements et espèces avant de renouveler un abonnement. Une déclaration ne prouve pas que les fonds ont été reçus.</p>
   </div>
  </div>
  <div className={styles.metricsInline}>
   <Link href="/admin/coordonnees-paiement" className={styles.secondary}>Configurer les coordonnées D17, bancaires et espèces →</Link>
   <Link href="/api/admin/subscription-payments/export?status=ALL" className={styles.secondary}>Exporter tous les règlements (CSV)</Link>
   <Link href="/api/admin/subscription-payments/export?status=PENDING" className={styles.secondary}>Exporter les dossiers à vérifier</Link>
   <Link href="/api/admin/subscription-payments/export?status=APPROVED" className={styles.secondary}>Exporter les règlements validés</Link>
   <span>Seuls les moyens de réception activés sont proposés aux marchands.</span>
  </div>
  <div className={styles.stats}>
   <div className={styles.stat}><span><Banknote size={17}/> Dossiers enregistrés</span><strong>{total}</strong><small>Toutes les déclarations</small></div>
   <div className={styles.stat}><span><Clock3 size={17}/> À vérifier</span><strong>{pending}</strong><small>Action administrative nécessaire</small></div>
   <div className={styles.stat}><span><CheckCheck size={17}/> Validés</span><strong>{approved}</strong><small>Abonnements renouvelés</small></div>
  </div>
  <div className={styles.inlineWarning}>
   <ShieldAlert size={18}/>
   <span><strong>Vérification humaine obligatoire :</strong> comparez le montant et la référence avec la réception réelle des fonds dans vos propres relevés D17 ou bancaires, ou avec un reçu d’espèces. Ne validez jamais une transaction sur la seule déclaration du marchand.</span>
  </div>
  <section className={styles.panel} aria-label="Rechercher des règlements">
   <form action="/admin/paiements" method="get" className={styles.filters}>
    <label>Recherche <input className={styles.simpleSelect} name="recherche" maxLength={100}
     defaultValue={query.search} placeholder="Marchand, référence, offre, boutique"/></label>
    <label>Décision <select className={styles.simpleSelect} name="status" defaultValue={query.status}>
     <option value="PENDING">À vérifier</option><option value="APPROVED">Validés</option>
     <option value="REJECTED">Refusés</option><option value="ALL">Tous</option>
    </select></label>
    <label>Moyen <select className={styles.simpleSelect} name="method" defaultValue={query.method}>
     <option value="">Tous les moyens</option><option value="D17">D17</option>
     <option value="BANK_TRANSFER">Virement bancaire</option><option value="CASH">Espèces</option>
    </select></label>
    <button type="submit" className={styles.primary}>Rechercher</button>
    <Link className={styles.secondary} href={paymentDirectoryHref('/api/admin/subscription-payments/export',query,paging.page)}>Exporter cette page (CSV)</Link>
   </form>
   <p style={{padding:'0 20px 16px'}}>Les dossiers les plus anciens sont présentés en premier. Les critères portent sur toute la base.</p>
  </section>
  <AdminPaymentQueue payments={payments} total={count} asOf={asOf}/>
  <nav className={styles.metricsInline} aria-label="Pagination des règlements">
   <strong>{count} résultat(s)</strong><span>Page {paging.page} / {paging.pages} · {PAYMENT_PAGE_SIZE} dossiers maximum par page</span>
   {paging.page>1&&<Link className={styles.secondary} href={paymentDirectoryHref('/admin/paiements',query,paging.page-1)}>Précédente</Link>}
   {paging.page<paging.pages&&<Link className={styles.secondary} href={paymentDirectoryHref('/admin/paiements',query,paging.page+1)}>Suivante</Link>}
  </nav>
 </>;
}
