import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import {ShieldCheck,Clock3} from 'lucide-react';
import {prisma} from '../../../modules/storage/client';
import PaymentSettings,{type MethodConfig} from './payment-settings';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';

export default async function OfficialReceptionSettings(){
 await requireSuperAdminPage();
 const [methods,changes]=await Promise.all([
  prisma.paymentReceptionMethod.findMany({orderBy:{code:'asc'}}),
  prisma.paymentReceptionAudit.findMany({
   select:{id:true,methodCode:true,createdAt:true,changed:true},
   orderBy:{createdAt:'desc'},take:10
  })
 ]);
 const records:MethodConfig[]=methods.map(row=>({
  code:row.code,enabled:row.enabled,recipientName:row.recipientName,
  identifier:row.identifier,bankName:row.bankName,
  instructions:row.instructions,version:row.version,
  updatedAt:row.updatedAt.toISOString()
 }));
 return <>
  <div className={styles.head}>
   <div>
    <span className={styles.eyebrow}>PARAMÈTRES SAAS · RÈGLEMENTS EXTERNES</span>
    <h1>Coordonnées officielles de paiement</h1>
    <p>Configurez les informations que les commerçants doivent consulter avant d’effectuer un virement, un règlement D17 ou une remise en espèces.</p>
   </div>
  </div>
  <PaymentSettings methods={records}/>
  <section className={styles.panel} style={{marginTop:22}}>
   <div className={styles.panelHead}>
    <div><h2><Clock3 size={18}/> Historique de configuration</h2>
     <p>Le journal ne répète pas les numéros D17 ou bancaires : seules les rubriques modifiées et l'activation sont enregistrées.</p>
    </div>
   </div>
   <div className={styles.auditList}>
    {changes.map(row=><div key={row.id} className={styles.auditItem}>
     <time>{row.createdAt.toLocaleString('fr-TN')}</time>
     <span>{row.methodCode} · Version mise à jour · {JSON.stringify(row.changed)}</span>
    </div>)}
    {!changes.length&&<div className={styles.mutedEmpty}>
     <ShieldCheck size={17}/> Aucun moyen de paiement modifié pour le moment.
    </div>}
   </div>
  </section>
 </>;
}
