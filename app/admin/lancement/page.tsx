import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import Link from 'next/link';
import {commercialLaunchStatus} from '../../../modules/platform/commercial-launch-status';
import styles from '../platform.module.css';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function AdminCommercialLaunch(){
 await requireSuperAdminPage();

 const status=commercialLaunchStatus(process.env);
 return <div>
  <div className={styles.head}><div>
   <span className={styles.eyebrow}>ADMINISTRATION GLOBALE · LANCEMENT</span>
   <h1>Préparation du lancement commercial</h1>
   <p>Cette vue indique les attestations déclarées côté serveur. Ni une variable d'environnement ni une compilation réussie ne prouvent à elles seules qu'une condition est satisfaite.</p>
  </div></div>
  <div className={styles.stats}>
   <section className={styles.stat}><span>Conditions prévues</span><strong>{status.total}</strong></section>
   <section className={styles.stat}><span>Attestations déclarées</span><strong>{status.declaredCount}</strong></section>
   <section className={styles.stat}><span>Points non attestés</span><strong>{status.missingCount}</strong></section>
   <section className={styles.stat}><span>Certification externe automatique</span><strong>Non</strong></section>
  </div>
  <section className={styles.panel}>
   <h2>{status.allAttested?'Attestations renseignées · preuves à examiner':'NO-GO · lancement commercial non autorisé'}</h2>
   <p>Une mise en ligne Render est possible en environnement pilote ; les sept points doivent être réellement testés et documentés avant la commercialisation. Aucun fournisseur, paiement bancaire ou sauvegarde externe n'est déclaré connecté par cette page.</p>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Condition</th><th>Déclaration serveur</th><th>Validation requise</th></tr></thead>
    <tbody>{status.rows.map(row=><tr key={row.key}>
     <td><strong>{row.label}</strong><small>{row.key}</small></td>
     <td>{row.declared?'Attestation présente · non certifiée':'Non attestée'}</td>
     <td>Preuve et revue indépendantes</td>
    </tr>)}</tbody>
   </table></div>
   <p>{status.note}</p>
  </section>
  <section className={styles.panel}>
   <h2>Traiter les points bloquants</h2>
   <p><Link href="/admin/integrations">Vérifier la configuration des prestataires externes</Link></p>
   <p><Link href="/admin/fiabilite">Contrôler l'intégrité des boutiques</Link></p>
   <p><Link href="https://github.com/dalimouxx/tunicommerce/blob/main/docs/p5-pilot-go-no-go.md">Protocole de lancement et conservation des preuves</Link></p>
   <p>Les secrets et documents d'identification ne doivent jamais être saisis dans des tickets, dans une page publique ou dans les paramètres d'une boutique.</p>
  </section>
 </div>;
}
