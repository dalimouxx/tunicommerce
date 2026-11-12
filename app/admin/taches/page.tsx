import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import {prisma} from '../../../modules/storage/client';
import {emailConfigured} from '../../../modules/messaging/email';
import styles from '../platform.module.css';
import {readWorkerHealth,JOB_RETENTION_DAYS,SECURITY_RETENTION_DAYS} from '../../../modules/jobs/operations';
export const dynamic='force-dynamic';
const labels:Record<string,string>={PENDING:'En attente',PROCESSING:'En traitement',SUCCEEDED:'Traité',FAILED:'Échec',CANCELLED:'Annulé'};
export default async function JobsPage(){
 await requireSuperAdminPage();
 const [rows,health]=await Promise.all([
  prisma.backgroundJob.findMany({orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,select:{
   id:true,kind:true,status:true,attempts:true,maxAttempts:true,errorCode:true,createdAt:true,availableAt:true,finishedAt:true}}),
  readWorkerHealth()
 ]);
 return <><div className={styles.head}><div><h1>Tâches en arrière-plan</h1><p>50 dernières tâches. Les liens et contenus chiffrés ne sont pas exposés dans cette vue.</p></div></div>
  <p>{emailConfigured()?'Configuration SMTP renseignée ; l’exécution du worker reste nécessaire.':'Service e-mail non configuré.'}</p>
  <section className={styles.panel} aria-label="État des workers"><div className={styles.panelHead}><div>
   <h2>{health.activeWorkers?`${health.activeWorkers} worker(s) actif(s)`:'Aucun worker actif détecté'}</h2>
   <p>Signal reçu depuis moins de deux minutes. Dernier signal : {health.lastSeenAt?health.lastSeenAt.toLocaleString('fr-TN'):'jamais reçu'}.
    Actualisez cette page pour consulter le nouvel état. Ce signal ne prouve pas la délivrabilité SMTP.</p>
   <p>{health.expiredLeases} bail(s) expiré(s) à reprendre. Plus ancienne tâche disponible : {health.oldestReadySeconds===null?'aucune':`${health.oldestReadySeconds} seconde(s)`}.</p>
   <p>Nettoyage automatique par le worker : tâches terminées après {JOB_RETENTION_DAYS} jours, événements de sécurité après {SECURITY_RETENTION_DAYS} jours. Les tâches en attente sont conservées.</p>
  </div></div></section>
  <div className={styles.metricsInline}><strong>{health.pending} tâche(s) à traiter</strong><span>{health.failed} échec(s)</span></div>
  <section className={styles.panel}><div className={styles.tableWrap}><table className={styles.table}>
   <thead><tr><th>Type</th><th>Création</th><th>État</th><th>Tentatives</th><th>Diagnostic</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.id}><td>{row.kind}</td><td>{row.createdAt.toLocaleString('fr-TN')}</td>
    <td>{labels[row.status]||row.status}</td><td>{row.attempts}/{row.maxAttempts}</td><td>{row.errorCode||'—'}</td></tr>)}</tbody>
  </table></div>{!rows.length&&<p>Aucune tâche enregistrée.</p>}</section></>;
}
