'use client';
import {AlertTriangle, Clock, Info, Sparkles, TrendingUp} from 'lucide-react';
import type {State} from '../../modules/commerce/types';
import {copilotInsights, type Insight, type Severity} from '../../modules/copilot/insights';
import styles from './copilot.module.css';

const meta: Record<Severity, {label: string; icon: typeof Info}> = {
 urgent: {label: 'URGENT', icon: AlertTriangle}, attention: {label: 'À SURVEILLER', icon: Clock},
 opportunity: {label: 'OPPORTUNITÉ', icon: TrendingUp}, info: {label: 'BON À SAVOIR', icon: Info},
};

/** Full list of tips computed from the shop's own figures (no AI, no external service). */
export function CopilotPage({state, go}: {state: State; go: (page: string) => void}) {
 const insights = copilotInsights(state);
 return <>
  <div className="info-strip"><Sparkles size={17}/>Ces conseils sont calculés à partir de vos commandes, de votre stock et de vos encaissements, à chaque ouverture de la page. Aucune donnée ne quitte votre espace. Un assistant conversationnel avec IA pourra s’y ajouter avec une clé d’API.</div>
  {insights.length
   ? <div className={styles.list}>{insights.map(insight => <InsightCard key={insight.id} insight={insight} go={go}/>)}</div>
   : <div className={'card ' + styles.empty}><h3>Tout est en ordre</h3><p>Aucune commande en retard, aucun stock faible, aucun encaissement oublié.</p></div>}
 </>;
}

function InsightCard({insight, go}: {insight: Insight; go: (page: string) => void}) {
 const {label, icon: Icon} = meta[insight.severity];
 return <article className={'card ' + styles.item + ' ' + styles[insight.severity]}>
  <span className={styles.dot} aria-hidden="true"><Icon size={17}/></span>
  <div><span className={styles.tag}>{label}</span><h3>{insight.title}</h3><p>{insight.detail}</p></div>
  {insight.action && <button className="button small-button" onClick={() => go(insight.action!.page)}>{insight.action.label}</button>}
 </article>;
}

/** Dashboard corner: the most pressing tips, linking to the full page. */
export function CopilotTeaser({state, go}: {state: State; go: (page: string) => void}) {
 const insights = copilotInsights(state);
 return <div className={styles.teaser}>
  <strong><Sparkles size={14}/>Commerce Copilot · {insights.length ? insights.length + ' conseil' + (insights.length > 1 ? 's' : '') : 'tout est en ordre'}</strong>
  {insights.slice(0, 2).map(i => <button key={i.id} data-severity={i.severity} onClick={() => go(i.action?.page || 'Commerce Copilot')}><i/>{i.title}</button>)}
  <button className={styles.more} onClick={() => go('Commerce Copilot')}>Voir tous les conseils →</button>
 </div>;
}
