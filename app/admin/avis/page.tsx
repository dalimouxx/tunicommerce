import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import {MessageSquareWarning,ShieldCheck} from 'lucide-react';
import {reportedReviews} from '../../../modules/reviews/service';
import {reportLabels} from '../../../modules/reviews/policy';
import ModerationButtons from './moderation-buttons';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function ReportedReviews(){
 await requireSuperAdminPage();
 const items=await reportedReviews();
 return <>
  <div className={styles.head}>
   <div><span className={styles.eyebrow}>MODÉRATION · AVIS CLIENTS</span>
    <h1>Avis signalés</h1>
    <p>Les avis sont publiés directement. Un marchand peut signaler un abus : l’avis est masqué jusqu’à votre décision. Rétablissez un avis honnête, même négatif ; retirez seulement les propos injurieux, les données personnelles ou les avis hors sujet. Chaque décision est inscrite au journal.</p>
   </div>
  </div>
  <div className={styles.metricsInline}><MessageSquareWarning size={19}/><strong>{items.length} avis en attente</strong><span>Du plus ancien signalement au plus récent.</span></div>
  <section className={styles.panel}>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Boutique</th><th>Avis</th><th>Motif du marchand</th><th>Décision</th></tr></thead>
    <tbody>{items.map(item=><tr key={item.id}>
     <td><strong>{item.shopName}</strong><small>Produit {item.productId}</small></td>
     <td><strong>{'★'.repeat(item.rating)+'☆'.repeat(5-item.rating)} · {item.authorName}</strong><small dir="auto" style={{whiteSpace:'pre-line'}}>{item.comment||'Sans commentaire'}</small></td>
     <td>{item.reportReason?reportLabels[item.reportReason as keyof typeof reportLabels]:'—'}<small>{item.reportedAt?.toLocaleString('fr-TN')}</small></td>
     <td><ModerationButtons reviewId={item.id}/></td>
    </tr>)}</tbody>
   </table></div>
   {!items.length&&<div className={styles.empty}><ShieldCheck size={27}/><strong>Aucun avis signalé</strong></div>}
  </section>
 </>;
}
