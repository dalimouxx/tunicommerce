'use client';
import {useState} from 'react';
import {MessageCircle} from 'lucide-react';
import type {State} from '../../modules/commerce/types';
import {
 MESSAGE_VARIABLES, messageRules, messageVariableLabels, readMessaging, renderMessage, type MessageRuleKey, type MessagingSettings,
} from '../../modules/messaging/customer-messages';
import type {Act} from './shared';
import styles from './messages.module.css';

/** One message per order status, proposed in the order panel and sent from the merchant's WhatsApp in one click. */
export function AutomationsPage({state, act, busy}: {state: State; act: Act; busy: boolean}) {
 const [rules, setRules] = useState<MessagingSettings['rules']>(() => readMessaging(state).rules);
 const sample = state.orders.find(o => o.tracking) || state.orders[0];
 const origin = typeof window === 'undefined' ? '' : window.location.origin;
 const update = (key: MessageRuleKey, change: Partial<MessagingSettings['rules'][MessageRuleKey]>) => setRules({...rules, [key]: {...rules[key], ...change}});
 const changed = JSON.stringify(rules) !== JSON.stringify(readMessaging(state).rules);
 return <>
  <div className="info-strip"><MessageCircle size={17}/>À chaque changement de statut, la fiche de la commande propose le bon message, déjà rempli. Il s’ouvre dans votre WhatsApp : vous vérifiez et envoyez. L’envoi entièrement automatique, sans clic, nécessitera un compte WhatsApp Business API.</div>
  <div className={styles.rules}>
   {messageRules.map(rule => {
    const current = rules[rule.key];
    return <section className={'card ' + styles.rule} key={rule.key} data-enabled={current.enabled}>
     <div className={styles.ruleHead}>
      <div><h3>{rule.label}</h3><p>{rule.hint}</p></div>
      <label className={styles.switch}><input type="checkbox" checked={current.enabled} onChange={e => update(rule.key, {enabled: e.target.checked})}/>{current.enabled ? 'Activé' : 'Désactivé'}</label>
     </div>
     <div className={styles.editor}>
      <textarea aria-label={'Message : ' + rule.label} maxLength={1000} value={current.text} onChange={e => update(rule.key, {text: e.target.value})}/>
      <div className={styles.chips} aria-label="Insérer une information de la commande">
       {MESSAGE_VARIABLES.map(variable => <button type="button" key={variable} title={messageVariableLabels[variable]} onClick={() => update(rule.key, {text: current.text.trimEnd() + ' ' + variable})}>{messageVariableLabels[variable]}</button>)}
      </div>
      {current.text !== rule.text && <button type="button" className={styles.reset} onClick={() => update(rule.key, {text: rule.text})}>Revenir au message proposé</button>}
     </div>
     <div className={styles.preview} aria-live="polite">
      <small>APERÇU{sample ? ' · COMMANDE ' + sample.reference : ''}</small>
      <div className={styles.bubble}>{sample ? renderMessage(current.text, state, sample, origin) : current.text}</div>
     </div>
    </section>;
   })}
  </div>
  <div className={styles.actions}>
   {changed && <button className="button" disabled={busy} onClick={() => setRules(readMessaging(state).rules)}>Annuler les modifications</button>}
   <button className="primary" disabled={busy || !changed || Object.values(rules).some(r => !r.text.trim())} onClick={() => void act('messaging', {rules})}>Enregistrer les messages</button>
  </div>
 </>;
}
