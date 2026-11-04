import {integrationReadiness} from '../../../modules/platform/integration-readiness';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function IntegrationReadinessPage(){
 // The parent layout enforces the global ADMIN role before this page is rendered.
 const rows=integrationReadiness(process.env);
 return <div>
  <div className={styles.head}><div>
   <span className={styles.eyebrow}>ADMINISTRATION GLOBALE · SERVICES EXTERNES</span>
   <h1>Préparation des intégrations</h1>
   <p>Contrôle de la présence des paramètres serveur. Les clés sont masquées : même avec toutes les variables, le prestataire n'est ni considéré connecté, ni certifié sans une intégration documentée et des tests sandbox.</p>
  </div></div>
  <div className={styles.stats}>
   <section className={styles.stat}><span>Services examinés</span><strong>{rows.length}</strong></section>
   <section className={styles.stat}><span>Variables complètes, non vérifiées</span><strong>{rows.filter(r=>r.status==='CREDENTIALS_PRESENT_UNVERIFIED').length}</strong></section>
   <section className={styles.stat}><span>Connexions réelles vérifiées</span><strong>0</strong><small>Aucun fournisseur certifié par ce diagnostic</small></section>
  </div>
  <section className={styles.panel}>
   <div className={styles.panelHead}><h2>Prestataires à contractualiser</h2></div>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Intégration</th><th>Usage</th><th>Variables</th><th>Diagnostic</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.kind}>
     <td><strong>{row.label}</strong></td><td>{row.purpose}</td>
     <td>{row.configuredKeys}/{row.requiredKeys} présentes</td>
     <td>{row.status==='NOT_CONFIGURED'?'Configuration manquante':'Clés présentes · non vérifiées'}
      {row.missingVariableNames.length>0&&<small>Manquantes : {row.missingVariableNames.join(', ')}</small>}</td>
    </tr>)}</tbody>
   </table></div>
  </section>
  <section className={styles.panel}><h2>Avant activation réelle</h2>
   <p>Signer un contrat avec chaque prestataire, récupérer ses spécifications API et ses accès sandbox, configurer les secrets uniquement dans Render, vérifier les signatures webhook et les reprises sur erreur, puis réussir des tests d'envoi et de rapprochement de bout en bout.</p>
   <p>Ne saisissez jamais d'identifiants de banque ou de clés API dans un champ public ou dans un ticket GitHub.</p>
  </section>
 </div>;
}
