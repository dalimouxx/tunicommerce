'use client';
import Link from 'next/link';
import {useState} from 'react';
import {orderMailEvents,orderMailVariables,orderMailTemplates,renderOrderMail,type OrderMailTemplates} from '../modules/messaging/order-mail';
import styles from './shop-pages.module.css';
type Settings={shopName:string;enabled:boolean;version:number;templates:OrderMailTemplates;recipient:string;verified:boolean;configured:boolean;
 jobs:{id:string;status:string;attempts:number;maxAttempts:number;errorCode:string|null;createdAt:string;finishedAt:string|null}[]};
const eventLabels={ORDER_CREATED:'Nouvelle commande',ORDER_STATUS_CHANGED:'Changement de statut'};
const jobLabels:Record<string,string>={PENDING:'En attente',PROCESSING:'En cours',SUCCEEDED:'Accepté par SMTP',FAILED:'Échec',CANCELLED:'Annulé'};
export default function OrderMailSettings({shopId,initial}:{shopId:string;initial:Settings}){
 const [data,setData]=useState(initial),[enabled,setEnabled]=useState(initial.enabled),[templates,setTemplates]=useState(initial.templates);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const [remote,setRemote]=useState<Settings|null>(null);
 const endpoint='/api/v1/shops/'+encodeURIComponent(shopId)+'/notifications';
 const dirty=enabled!==data.enabled||JSON.stringify(templates)!==JSON.stringify(data.templates);
 async function load(save:boolean){
  setBusy(true);setNotice('');setError('');
  try{
   const response=await fetch(endpoint,{method:save?'PUT':'GET',cache:'no-store',signal:AbortSignal.timeout(45000),
    ...(save?{headers:{'content-type':'application/json'},body:JSON.stringify({enabled,templates,expectedVersion:data.version})}:{})});
   const next=await response.json();if(!response.ok)throw Error(next.error||'Enregistrement indisponible.');
   if(!save&&dirty&&next.version!==data.version){
    setRemote(next);setData(old=>({...old,jobs:next.jobs,configured:next.configured,verified:next.verified,recipient:next.recipient}));
    setError('Les réglages ont changé ailleurs. Vos textes sont conservés ; comparez-les avant de reprendre les réglages du serveur.');return;
   }
   setRemote(null);setData(next);if(save||!dirty){setEnabled(next.enabled);setTemplates(next.templates);}
   setNotice(save?'Réglages enregistrés. Aucun e-mail de test n’a été envoyé.':dirty?'État rechargé ; vos textes en cours d’édition sont conservés.':'État actualisé.');
  }catch(e){setError(e instanceof Error?e.message:'Service indisponible. Vos textes sont conservés dans cet écran.');}
  finally{setBusy(false);}
 }
 const valid=orderMailTemplates.safeParse(templates);
 return <><header className={styles.head}><div><h1>Vos alertes de commande</h1><p>Un suivi discret dans votre boîte mail, avec vos propres modèles.</p></div></header>
  <section className={styles.panel}><h2>Destination et activation</h2>
   <p>Uniquement vers votre adresse de propriétaire : <strong>{data.recipient}</strong>. Les clients ne reçoivent aucun message par ce réglage.</p>
   <p>{data.configured?'Configuration SMTP renseignée. Le worker doit être actif pour traiter les alertes.':'Service e-mail non configuré : vous pouvez préparer vos modèles, mais pas activer les envois.'}</p>
   {!data.verified&&<p><Link href="/compte/securite">Vérifier mon adresse dans la sécurité du compte</Link> avant l’activation.</p>}
   <label><input type="checkbox" checked={enabled} disabled={busy||!data.enabled&&(!data.configured||!data.verified)} onChange={e=>setEnabled(e.target.checked)}/> Recevoir les nouvelles commandes et changements de statut</label>
   <p className={styles.muted}>Les alertes concernent les événements futurs. Désactiver annule celles encore en attente ; un envoi déjà commencé peut aboutir. Une acceptation SMTP ne prouve pas la réception, et une reprise après incident peut produire un doublon.</p>
  </section>
  <section className={styles.panel}><h2>Vos modèles</h2><p>Texte simple, en français ou en arabe. Variables disponibles : {orderMailVariables.map(v=>'{'+v+'}').join(' · ')}.</p>
   <div className={styles.form}>{orderMailEvents.map(event=>{
    const preview=valid.success?renderOrderMail(valid.data[event],{shopName:data.shopName,reference:'TC-EXEMPLE',status:'CONFIRMED',total:59000,url:'https://exemple.test/espace-prive',at:'2026-11-12T12:00:00Z'}):null;
    return <fieldset className={styles.sectionEditor} key={event} disabled={busy}><legend>{eventLabels[event]}</legend>
     <label>Objet<input dir="auto" maxLength={160} value={templates[event].subject} onChange={e=>setTemplates(old=>({...old,[event]:{...old[event],subject:e.target.value}}))}/></label>
     <label>Message<textarea dir="auto" rows={7} maxLength={4000} value={templates[event].body} onChange={e=>setTemplates(old=>({...old,[event]:{...old[event],body:e.target.value}}))}/></label>
     {preview&&<details><summary>Aperçu avec des données fictives</summary><strong dir="auto">{preview.subject}</strong><p dir="auto" className={styles.prose}>{preview.text}</p></details>}
    </fieldset>;
   })}</div>
   {!valid.success&&<p className={styles.error} role="alert">{valid.error.issues[0]?.message}</p>}
   <div className={styles.actions}><button className={styles.primary} disabled={busy||!valid.success||!dirty} onClick={()=>void load(true)}>{busy?'Traitement…':'Enregistrer mes réglages'}</button>
    <button className={styles.secondary} disabled={busy} onClick={()=>void load(false)}>Actualiser l’état</button></div>
   {notice&&<p className={styles.success} role="status">{notice}</p>}{error&&<p className={styles.error} role="alert">{error}</p>}
   {remote&&<details><summary>Comparer avec les réglages enregistrés ailleurs</summary>
    <p>Alertes {remote.enabled?'activées':'désactivées'} · version {remote.version}</p>
    {orderMailEvents.map(event=><div key={event}><h3>{eventLabels[event]}</h3><strong dir="auto">{remote.templates[event].subject}</strong><p className={styles.prose} dir="auto">{remote.templates[event].body}</p></div>)}
    <button className={styles.secondary} disabled={busy} onClick={()=>{setData(remote);setTemplates(remote.templates);setEnabled(remote.enabled);setRemote(null);setError('');setNotice('Réglages du serveur repris. Le brouillon local a été remplacé.');}}>Remplacer mon brouillon par ces réglages</button>
   </details>}
  </section>
  <section className={styles.panel}><h2>Les 30 dernières alertes</h2><p>Les coordonnées des acheteurs, les notes internes et le contenu chiffré ne figurent pas dans ce journal.</p>
   {!data.jobs.length?<p>Aucune alerte enregistrée pour cette boutique.</p>:<ul>{data.jobs.map(job=><li key={job.id}>
    {new Date(job.createdAt).toLocaleString('fr-TN')} · {jobLabels[job.status]||job.status} · {job.attempts}/{job.maxAttempts} tentative(s){job.errorCode?' · '+job.errorCode:''}
   </li>)}</ul>}
  </section></>;
}
