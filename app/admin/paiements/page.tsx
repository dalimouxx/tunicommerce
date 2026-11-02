import {Banknote,Clock3,CheckCheck,ShieldAlert} from 'lucide-react';
import {prisma} from '../../../modules/storage/client';
import Link from 'next/link';
import AdminPaymentQueue,{type AdminPaymentRow} from './payment-queue';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';

export default async function AdminSaasPayments(){
 const [rows,total,pending,approved]=await Promise.all([
  prisma.subscriptionPayment.findMany({
   orderBy:[{createdAt:'desc'}],take:200,
   select:{
    id:true,reference:true,workspaceId:true,planCode:true,planName:true,
    priceMillimes:true,durationDays:true,method:true,transferReference:true,
    merchantNote:true,status:true,adminNote:true,createdAt:true,decidedAt:true,
    periodEndsAt:true,
    workspace:{select:{slug:true,owner:{select:{name:true,email:true}}}}
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
  <AdminPaymentQueue payments={payments} total={total}/>
 </>;
}
