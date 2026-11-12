'use client';
import Link from 'next/link';
import {useRef,useState} from 'react';
import type {readWebhookSettings} from '../modules/messaging/webhook-service';
import {labels,type Status} from '../modules/commerce/types';
import styles from './shop-pages.module.css';
type Settings=Awaited<ReturnType<typeof readWebhookSettings>>;
const jobLabels:Record<string,string>={PENDING:'En attente',PROCESSING:'En cours',SUCCEEDED:'Accepté par la destination',FAILED:'Échec',CANCELLED:'Annulé'};
const errors:Record<string,string>={DELIVERY_FAILED:'Destination temporairement indisponible',WEBHOOK_REJECTED:'Destination refusée',EXPIRED:'Événement expiré ou accès révoqué',
 CONFIGURATION_MISSING:'Configuration à vérifier',INVALID_PAYLOAD:'Contenu indisponible',LEASE_EXPIRED:'Traitement interrompu'};
export default function WebhookSettings({shopId,initial}:{shopId:string;initial:Settings}){
 const [data,setData]=useState(initial),[endpoint,setEndpoint]=useState(initial.endpoint),[enabled,setEnabled]=useState(initial.enabled);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[secret,setSecret]=useState('');
 const [confirmRotation,setConfirmRotation]=useState(false),[remote,setRemote]=useState<Settings|null>(null);
 const retryIds=useRef(new Map<string,string>()),url='/api/v1/shops/'+encodeURIComponent(shopId)+'/webhook';
 const dirty=endpoint!==data.endpoint||enabled!==data.enabled;
 async function action(kind:'save'|'rotate'|'retry',eventId?:string){
  setBusy(true);setError('');setNotice('');setConfirmRotation(false);
  const requestId=eventId?(retryIds.current.get(eventId)??crypto.randomUUID()):undefined;
  if(eventId&&requestId)retryIds.current.set(eventId,requestId);
  try{
   const body=kind==='save'?{action:kind,endpoint,enabled,expectedVersion:data.version}:kind==='rotate'?{action:kind,expectedVersion:data.version}:
    {action:kind,eventId,requestId,expectedVersion:data.version};
   const response=await fetch(url,{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Enregistrement indisponible.');
   const {secret:newSecret,alreadyApplied,...view}=result;
   if(newSecret)setSecret(newSecret);setData(view);setRemote(null);
   if(kind!=='retry'){setEndpoint(view.endpoint);setEnabled(view.enabled);}
   if(eventId)retryIds.current.delete(eventId);
   setNotice(kind==='rotate'?'Nouvelle clé créée. Les envois sont désactivés ; configurez la destination avant de les réactiver.':
    kind==='retry'?(alreadyApplied?'Cette relance était déjà enregistrée.':'Relance enregistrée dans la file. La réception n’est pas encore confirmée.'):'Réglages enregistrés. Aucun événement de test n’a été envoyé.');
  }catch(e){setError(e instanceof Error?e.message:'Service indisponible.');}
  finally{setBusy(false);}
 }
 async function refresh(){
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(45000)}),view=await response.json();
   if(!response.ok)throw Error(view.error||'Journal indisponible.');
   if(dirty&&view.version!==data.version){
    setSecret('');setRemote(view);setData(old=>({...old,events:view.events,budgetUsed:view.budgetUsed,droppedCount:view.droppedCount,lastDropAt:view.lastDropAt,
     configured:view.configured,verified:view.verified,encryptionReady:view.encryptionReady}));
    setError('Des réglages ont changé ailleurs. Votre adresse en cours d’édition est conservée pour comparaison.');return;
   }
   if(view.version!==data.version)setSecret('');
   setData(view);setRemote(null);if(!dirty){setEndpoint(view.endpoint);setEnabled(view.enabled);}setNotice('Journal actualisé.');
  }catch(e){setError(e instanceof Error?e.message:'Journal indisponible.');}
  finally{setBusy(false);}
 }
 return <><header className={styles.head}><div><h1>Connectez vos outils</h1><p>Des événements de commande signés, vers une destination que vous choisissez.</p></div></header>
  <section className={styles.panel}><h2>Votre destination</h2>
   <p>Les nouvelles commandes et changements de statut peuvent être envoyés à votre service HTTPS. Ils contiennent la référence, l’état, le total et l’identifiant de commande ; aucune coordonnée client ni note interne.</p>
   {!data.configured&&<p className={styles.muted}>Les envois externes ne sont pas configurés par l’exploitant. Cette présence dans l’application n’atteste aucune connexion à un transporteur ou service de paiement.</p>}
   {!data.encryptionReady&&<p>Le chiffrement doit être configuré avant d’enregistrer une adresse ou de créer une clé.</p>}
   {!data.endpointReadable&&<p role="alert" className={styles.error}>La destination enregistrée ne peut pas être lue. Demandez à l’exploitant de vérifier le chiffrement.</p>}
   <div className={styles.form}><label>Adresse HTTPS du service<input type="url" autoComplete="off" maxLength={2048} value={endpoint} disabled={busy} onChange={e=>setEndpoint(e.target.value)} placeholder="https://votre-service.tn/evenements"/></label></div>
   {data.endpoint&&!data.allowed&&<p>Cette destination doit être autorisée par l’exploitant avant activation.</p>}
   {!data.verified&&<p><Link href="/compte/securite">Vérifiez votre adresse de compte</Link> avant d’activer les échanges.</p>}
   <label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} disabled={busy||!data.enabled&&(!data.configured||!data.keyConfigured||!data.verified||!data.allowed)}/> Activer les événements vers ce service</label>
   <p className={styles.muted}>Une modification des réglages annule les envois encore en attente. Un envoi déjà engagé peut aboutir. Le service destinataire doit vérifier la signature et éviter les doubles traitements.</p>
   <button className={styles.primary} disabled={busy||!dirty||!!remote} onClick={()=>void action('save')}>Enregistrer la destination</button>
  </section>
  <section className={styles.panel}><h2>Clé de vérification</h2><p>{data.keyConfigured?'Une clé est enregistrée. Elle n’est pas consultable à nouveau.':'Créez une clé puis configurez sa vérification dans votre service destinataire.'}</p>
   <button className={styles.secondary} disabled={busy||dirty||!!remote||!data.encryptionReady} onClick={()=>{if(data.keyConfigured)setConfirmRotation(true);else void action('rotate');}}>{data.keyConfigured?'Renouveler la clé':'Créer la clé'}</button>
   {confirmRotation&&<div className={styles.error}><p>Renouveler la clé désactive les envois et annule les tâches en attente. L’ancienne clé ne signera plus les nouveaux événements.</p>
    <button className={styles.secondary} disabled={busy} onClick={()=>void action('rotate')}>Confirmer le renouvellement</button>{' '}<button className={styles.secondary} onClick={()=>setConfirmRotation(false)}>Conserver la clé actuelle</button></div>}
   {secret&&<div className={styles.sectionEditor}><strong>Conservez cette clé dans votre gestionnaire de secrets</strong><p>Elle disparaîtra de cet écran après rechargement. Ne la partagez pas dans un ticket ou une conversation.</p>
    <textarea aria-label="Clé de signature créée" readOnly autoComplete="off" spellCheck={false} value={secret} rows={2}/>
    <button className={styles.secondary} onClick={()=>setSecret('')}>Masquer la clé</button></div>}
  </section>
  {notice&&<p className={styles.success} role="status">{notice}</p>}{error&&<p className={styles.error} role="alert">{error}</p>}
  {remote&&<section className={styles.panel}><h2>Réglages enregistrés ailleurs</h2><p>{remote.endpoint||'Aucune destination'} · {remote.enabled?'activé':'désactivé'} · version {remote.version}</p>
   <button className={styles.secondary} disabled={busy} onClick={()=>{setData(remote);setEndpoint(remote.endpoint);setEnabled(remote.enabled);setRemote(null);setError('');}}>Remplacer mon brouillon par ces réglages</button></section>}
  <section className={styles.panel}><h2>Les 30 derniers événements</h2><p>Demandes du jour UTC : {data.budgetUsed}/{data.budgetLimit}. Les reprises automatiques sont limitées à quatre tentatives par traitement.</p>
   {data.droppedCount>0&&<p className={styles.error}>{data.droppedCount} événement(s) non mis en file à cause de la limite quotidienne. Les commandes restent enregistrées.</p>}
   <button className={styles.secondary} disabled={busy} onClick={()=>void refresh()}>Actualiser le journal</button>
   {!data.events.length?<p>Aucun événement externe enregistré pour cette boutique.</p>:<ul>{data.events.map(event=><li className={styles.sectionEditor} key={event.id}>
    <strong>{event.reference||'Événement indisponible'} · {event.type==='ORDER_CREATED'?'Nouvelle commande':'Changement de statut'}</strong>
    <span>{new Date(event.createdAt).toLocaleString('fr-TN')}{event.orderStatus?' · '+labels[event.orderStatus as Status]:''}</span>
    <span>{event.job?jobLabels[event.job.status]||event.job.status:'État indisponible'} · {event.deliveryCount}/5 traitement(s){event.job?' · '+event.job.attempts+'/'+event.job.maxAttempts+' tentative(s)':''}</span>
    {event.job?.errorCode&&<span>{errors[event.job.errorCode]||'Vérification nécessaire'}</span>}
    {event.canRetry&&<button className={styles.secondary} disabled={busy||dirty||!!remote} onClick={()=>void action('retry',event.id)}>Relancer cet événement</button>}
   </li>)}</ul>}
   <p className={styles.muted}>Une acceptation HTTP ne prouve pas l’exécution métier. Les événements peuvent arriver plusieurs fois ou dans un ordre différent. Une relance conserve l’identifiant de l’événement et reste possible pendant 48 heures.</p>
  </section></>;
}
