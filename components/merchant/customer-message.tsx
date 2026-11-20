'use client';
import {useEffect, useState} from 'react';
import {MessageCircle, Smartphone} from 'lucide-react';
import type {Order, State} from '../../modules/commerce/types';
import {messageRules, orderPhone, readMessaging, renderMessage, ruleForStatus, smsMessageUrl, whatsappMessageUrl, type MessageRuleKey} from '../../modules/messaging/customer-messages';
import type {Act} from './shared';
import styles from './messages.module.css';

/** Order panel block: the message for the current status, editable for this one send, opened in WhatsApp. */
export function CustomerMessage({state, order, act, openSettings}: {state: State; order: Order; act: Act; openSettings: () => void}) {
 const enabled = messageRules.filter(r => readMessaging(state).rules[r.key].enabled);
 const suggested = ruleForStatus(state, order.status)?.key || '';
 const [key, setKey] = useState<MessageRuleKey | ''>(suggested);
 const template = key ? readMessaging(state).rules[key].text : '';
 const [text, setText] = useState('');
 // A new status proposes its own message.
 useEffect(() => { setKey(suggested); }, [suggested, order.id]);
 useEffect(() => { setText(template ? renderMessage(template, state, order, window.location.origin) : ''); }, [template, order, state]);
 const url = whatsappMessageUrl(orderPhone(state, order), text);
 const sms = smsMessageUrl(orderPhone(state, order), text);
 return <section className={styles.customer} aria-label="Message au client">
  <h3>Message au client</h3>
  {!enabled.length
   ? <p className={styles.muted}>Tous les messages sont désactivés. <button className="text-button" onClick={openSettings}>Activer des messages</button></p>
   : <>
    <select aria-label="Message à envoyer" value={key} onChange={e => setKey(e.target.value as MessageRuleKey | '')}>
     <option value="">Choisir un message…</option>
     {enabled.map(r => <option key={r.key} value={r.key}>{r.label}{r.key === suggested ? ' · conseillé maintenant' : ''}</option>)}
    </select>
    {key && <textarea aria-label="Texte du message" maxLength={1000} value={text} onChange={e => setText(e.target.value)}/>}
    {key && (url
     ? <div className={styles.sendRow}>
      <a className={styles.send} href={url} target="_blank" rel="noopener noreferrer" onClick={() => void act('logMessage', {id: order.id, rule: key, channel: 'WHATSAPP'})}><MessageCircle size={16}/>Envoyer sur WhatsApp</a>
      <a className={styles.sms} href={sms} onClick={() => void act('logMessage', {id: order.id, rule: key, channel: 'SMS'})}><Smartphone size={16}/>Envoyer par SMS</a>
     </div>
     : <p className={styles.muted}>Le numéro du client n’est pas un mobile tunisien valide : WhatsApp et SMS ne peuvent pas l’ouvrir.</p>)}
    <p className={styles.muted}>Le message s’ouvre dans votre WhatsApp, ou dans l’application SMS de votre téléphone ; rien n’est envoyé sans votre validation. <button className="text-button" onClick={openSettings}>Modifier les messages</button></p>
   </>}
 </section>;
}
