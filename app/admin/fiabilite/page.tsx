import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../../modules/auth/session';
import {prisma} from '../../../modules/storage/client';
import {mergeCommerceIntegrity} from '../../../modules/platform/commerce-integrity';
import {normalizeState} from '../../../modules/commerce/normalize';
import type {State} from '../../../modules/commerce/types';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
const labels={
 NEGATIVE_STOCK:'Stock produit négatif',
 DUPLICATE_PRODUCT_ID:'Identifiants produits dupliqués',
 DUPLICATE_SKU:'Références SKU dupliquées',
 WAREHOUSE_BALANCE_MISMATCH:'Stock global différent de la somme des dépôts',
 INVALID_WAREHOUSE_REFERENCE:'Emplacement de stock introuvable',
 DUPLICATE_CHECKOUT_TOKEN:'Jetons de suivi de commande dupliqués',
 DUPLICATE_ORDER_ID:'Identifiants commandes dupliqués',
 NEGATIVE_WAREHOUSE_BALANCE:'Quantités négatives par dépôt'
} as const;
export default async function PlatformIntegrityPage(){
 const actor=await getCurrentUser();
 if(!actor)redirect('/login');
 if(actor.role!=='ADMIN')redirect('/marchand');
 const [totalShops,rows,organizations,activeMembers]=await Promise.all([
  prisma.shopCommerce.count(),
  prisma.shopCommerce.findMany({orderBy:{updatedAt:'desc'},take:100,select:{data:true}}),
  prisma.organization.count(),
  prisma.membership.count({where:{active:true}})
 ]);
 const report=mergeCommerceIntegrity(rows.map(row=>normalizeState(row.data as unknown as State)));
 const incomplete=rows.length<totalShops;
 return <div>
  <div className={styles.head}><div>
   <span className={styles.eyebrow}>ADMINISTRATION GLOBALE · INTÉGRITÉ</span>
   <h1>Fiabilité et contrôle des données</h1>
   <p>Diagnostic en lecture seule, sans noms de clients, coordonnées, références de commande ou identifiants commerciaux détaillés. Les résultats ne certifient pas les paiements ni les intégrations externes.</p>
  </div></div>
  <div className={styles.stats}>
   <section className={styles.stat}><span>Commerces contrôlés</span><strong>{report.checkedShops}/{totalShops}</strong></section>
   <section className={styles.stat}><span>Organisations</span><strong>{organizations}</strong></section>
   <section className={styles.stat}><span>Membres actifs</span><strong>{activeMembers}</strong></section>
   <section className={styles.stat}><span>Commerces avec anomalies</span><strong>{report.shopsWithFindings}</strong></section>
   <section className={styles.stat}><span>Commandes examinées</span><strong>{report.orders}</strong></section>
  </div>
  {incomplete&&<p role="alert">Contrôle partiel : seules les 100 boutiques récemment modifiées ont été analysées. Les autres données ne sont pas certifiées.</p>}
  <section className={styles.panel}>
   <h2>Contrôles métiers · {report.shopsWithFindings===0?'Aucune anomalie détectée dans l’échantillon':'Anomalies à examiner'}</h2>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Vérification</th><th>Occurrences détectées</th></tr></thead>
    <tbody>{report.totals.map(row=><tr key={row.code}>
     <td>{labels[row.code]}</td><td><strong>{row.count}</strong></td>
    </tr>)}</tbody></table></div>
   <p>Ce rapport analyse des invariants internes des données JSON et des dépôts. Il ne remplace pas des tests transactionnels ni un audit de sécurité externe.</p>
  </section>
  <section className={styles.panel}>
   <h2>Sauvegarde et reprise après incident</h2>
   <p>Avant commercialisation, une sauvegarde indépendante et son exercice de restauration Neon doivent être validés. Un exercice PostgreSQL jetable est automatisé dans GitHub Actions ; ce n'est pas une preuve de restauration de la branche Neon active.</p>
   <Link href="https://github.com/dalimouxx/tunicommerce/blob/main/docs/priority1-neon-recovery-runbook.md">Procédure de reprise et limites connues</Link>
   <p>Le diagnostic ne lit aucune clé d'API ni information personnelle d'acheteur.</p>
  </section>
 </div>;
}
