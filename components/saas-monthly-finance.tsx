import Link from 'next/link';
import {financialReportHref,type FinancialReportQuery,type FinancialTotals} from '../modules/billing/financial-report';
import type {loadFinancialReport} from '../modules/billing/financial-report-service';
import {paymentMethodLabel,toTnd} from '../modules/billing/validation';
import styles from '../app/admin/platform.module.css';

type Report=Awaited<ReturnType<typeof loadFinancialReport>>;
export default function SaasMonthlyFinance({query,report,previous,plans}:{
 query:FinancialReportQuery;report:Report;previous:FinancialTotals;plans:{code:string;name:string}[]
}){
 const current=report.totals.APPROVED.millimes,prior=previous.APPROVED.millimes;
 const variation=prior>0?(current-prior)/prior*100:null;
 const compare=variation===null?'Pas de base de comparaison':
  (variation>0?'+':'')+new Intl.NumberFormat('fr-TN',{maximumFractionDigits:1}).format(variation)+' %';
 function table(title:string,rows:Report['byPlan'],method=false){
  return <section className={styles.panel}>
   <div className={styles.panelHead}><div><h2>{title}</h2><p>{query.label} · {query.plan||'Toutes les offres'} · {query.method?paymentMethodLabel(query.method):'Tous les moyens'}</p></div></div>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>{method?'Moyen':'Offre'}</th><th>Validés</th><th>Montant validé</th><th>En attente</th><th>Montant déclaré en attente</th><th>Refusés</th><th>Montant déclaré refusé</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.key}>
     <td><strong>{method?paymentMethodLabel(row.key):row.key}</strong></td>
     {(['APPROVED','PENDING','REJECTED'] as const).map(status=><FinanceCells key={status} totals={row.totals[status]}/>)}
    </tr>)}</tbody>
   </table></div>
   {!rows.length&&<p style={{padding:20}}>Aucun dossier correspondant pour ce mois et ces filtres.</p>}
  </section>;
 }
 return <section aria-labelledby="finance-mensuelle">
  <div className={styles.head}><div><h2 id="finance-mensuelle">Bilan mensuel · {query.label}</h2>
   <p>Validations et refus selon leur date de décision ; dossiers encore en attente selon leur mois de dépôt. Calendrier et horaires de Tunisie.</p></div></div>
  <section className={styles.panel}>
   <form action="/admin/finances-saas" method="get" className={styles.filters}>
    <label>Mois <input className={styles.simpleSelect} type="month" name="mois" min="2020-01" max="2100-12" required defaultValue={query.month}/></label>
    <label>Offre <select className={styles.simpleSelect} name="offre" defaultValue={query.plan}>
     <option value="">Toutes les offres</option>
     {query.plan&&!plans.some(plan=>plan.code===query.plan)&&<option value={query.plan}>{query.plan} (ancienne offre)</option>}
     {plans.map(plan=><option value={plan.code} key={plan.code}>{plan.name} · {plan.code}</option>)}
    </select></label>
    <label>Moyen <select className={styles.simpleSelect} name="method" defaultValue={query.method}>
     <option value="">Tous les moyens</option><option value="D17">D17</option><option value="BANK_TRANSFER">Virement bancaire</option><option value="CASH">Espèces</option>
    </select></label>
    <button type="submit" className={styles.primary}>Afficher le bilan</button>
    <Link className={styles.secondary} href={financialReportHref('/api/admin/finances-saas/export',query)}>Exporter le bilan (CSV)</Link>
   </form>
  </section>
  <div className={styles.stats}>
   {([
    ['Règlements validés',toTnd(current),report.totals.APPROVED.count+' décision(s) dans le mois'],
    ['Déclarations encore en attente',toTnd(report.totals.PENDING.millimes),report.totals.PENDING.count+' dossier(s) déposés dans le mois'],
    ['Déclarations refusées',toTnd(report.totals.REJECTED.millimes),report.totals.REJECTED.count+' décision(s) de refus dans le mois'],
    ['Validations · comparaison mensuelle',compare,toTnd(prior)+' validés en '+query.previousMonth+' avec les mêmes filtres']
   ] as const).map(([label,value,detail])=><section className={styles.stat} key={label}>
    <span>{label}</span><strong>{value}</strong><small>{detail}</small>
   </section>)}
  </div>
  {table('Répartition par offre',report.byPlan)}
  {table('Répartition par moyen de règlement',report.byMethod,true)}
  <p className={styles.metricsInline}>Les montants en attente ou refusés ne sont pas ajoutés aux règlements validés. La comparaison porte sur des mois calendaires ; le mois courant peut être incomplet. La situation des dossiers en attente évolue avec leur traitement ; ce bilan ne constitue pas un arrêté comptable historique.</p>
 </section>;
}
function FinanceCells({totals}:{totals:{count:number;millimes:number}}){
 return <><td>{totals.count}</td><td>{toTnd(totals.millimes)}</td></>;
}
