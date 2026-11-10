import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import {prisma} from '../../../modules/storage/client';
import {emailConfigured} from '../../../modules/messaging/email';
import styles from '../platform.module.css';
export const dynamic='force-dynamic';
const labels:Record<string,string>={PENDING:'En attente',PROCESSING:'En traitement',SUCCEEDED:'Traité',FAILED:'Échec',CANCELLED:'Annulé'};
export default async function JobsPage(){
 await requireSuperAdminPage();
 const [rows,pending,failed]=await Promise.all([
  prisma.backgroundJob.findMany({orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,select:{
   id:true,kind:true,status:true,attempts:true,maxAttempts:true,errorCode:true,createdAt:true,availableAt:true,finishedAt:true}}),
  prisma.backgroundJob.count({where:{status:{in:['PENDING','PROCESSING']}}}),prisma.backgroundJob.count({where:{status:'FAILED'}})
 ]);
 return <><div className={styles.head}><div><h1>Tâches en arrière-plan</h1><p>50 dernières tâches. Les liens et contenus chiffrés ne sont pas exposés dans cette vue.</p></div></div>
  <p>{emailConfigured()?'Configuration SMTP renseignée ; l’exécution du worker reste nécessaire.':'Service e-mail non configuré.'}</p>
  <div className={styles.metricsInline}><strong>{pending} tâche(s) à traiter</strong><span>{failed} échec(s)</span></div>
  <section className={styles.panel}><div className={styles.tableWrap}><table className={styles.table}>
   <thead><tr><th>Type</th><th>Création</th><th>État</th><th>Tentatives</th><th>Diagnostic</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.id}><td>{row.kind}</td><td>{row.createdAt.toLocaleString('fr-TN')}</td>
    <td>{labels[row.status]||row.status}</td><td>{row.attempts}/{row.maxAttempts}</td><td>{row.errorCode||'—'}</td></tr>)}</tbody>
  </table></div>{!rows.length&&<p>Aucune tâche enregistrée.</p>}</section></>;
}
