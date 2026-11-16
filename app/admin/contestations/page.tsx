import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import {Scale,ShieldCheck} from 'lucide-react';
import {pendingContests} from '../../../modules/reliability/service';
import {encryptionConfigured} from '../../../modules/security/envelope';
import ContestDecision from './contest-decision';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function RefusalContests(){
 await requireSuperAdminPage();
 const items=await pendingContests();
 return <>
  <div className={styles.head}>
   <div><span className={styles.eyebrow}>FIABILITÉ DES CLIENTS · CONTESTATIONS</span>
    <h1>Refus contestés</h1>
    <p>Les boutiques voient, pour le numéro d’une commande, le nombre de livraisons réussies et refusées sur Tunicom (compteurs uniquement). Un client peut contester un refus depuis son lien de suivi : le refus cesse d’être compté jusqu’à votre décision. Retirez-le s’il est erroné (livreur injoignable, mauvaise adresse de la boutique…), maintenez-le sinon. Chaque décision est inscrite au journal.</p>
    {!encryptionConfigured()&&<p><strong>APP_ENCRYPTION_SECRET n’est pas configuré : l’historique de fiabilité est désactivé.</strong></p>}
   </div>
  </div>
  <div className={styles.metricsInline}><Scale size={19}/><strong>{items.length} contestation(s) en attente</strong><span>De la plus ancienne à la plus récente.</span></div>
  <section className={styles.panel}>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Commande</th><th>Motif du client</th><th>Historique de la commande</th><th>Décision</th></tr></thead>
    <tbody>{items.map(item=><tr key={item.id}>
     <td><strong>{item.reference} · {item.shopName}</strong><small>Refus du {item.refusedAt.toLocaleDateString('fr-TN')}{item.carrier?' · '+item.carrier:''}{item.tracking?' · '+item.tracking:''}</small></td>
     <td><small dir="auto" style={{whiteSpace:'pre-line'}}>{item.reason}</small><small>{item.contestedAt?.toLocaleString('fr-TN')}</small></td>
     <td><small>{item.events.map(event=>new Date(event.at).toLocaleDateString('fr-TN')+' · '+event.label).join('\n')}</small></td>
     <td><ContestDecision id={item.id}/></td>
    </tr>)}</tbody>
   </table></div>
   {!items.length&&<div className={styles.empty}><ShieldCheck size={27}/><strong>Aucune contestation en attente</strong></div>}
  </section>
 </>;
}
