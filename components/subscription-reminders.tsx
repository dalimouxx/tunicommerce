'use client';
import {useState} from 'react';
import styles from '../app/mon-abonnement/plan.module.css';
type Settings={enabled:boolean;version:number;configured:boolean;verified:boolean;recipient:string;
 jobs:{id:string;status:string;attempts:number;errorCode:string|null;createdAt:string;finishedAt:string|null}[]};
const status:Record<string,string>={PENDING:'En attente',PROCESSING:'En cours',SUCCEEDED:'Accepté par le service e-mail',FAILED:'Non envoyé',CANCELLED:'Annulé'};
export default function SubscriptionReminders({initial}:{initial:Settings}){
 const [settings,setSettings]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function update(refresh=false){
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/auth/account/subscription-reminders',refresh?{cache:'no-store'}:{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({enabled:!settings.enabled,expectedVersion:settings.version})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Les réglages sont indisponibles.');
   setSettings(data);setMessage(refresh?'État actualisé.':data.enabled?'Rappels activés.':'Rappels désactivés.');
  }catch(error){setMessage(error instanceof Error?error.message:'Connexion indisponible. Actualisez l’état avant de réessayer.');}
  finally{setBusy(false);}
 }
 return <div>
  <p>Recevez un rappel dans les sept jours précédant l’échéance, un autre dans les dernières 24 heures, puis à l’expiration. Les rappels concernent votre compte et toutes ses boutiques.</p>
  <p><strong>{settings.enabled?'Rappels activés':'Rappels désactivés'}</strong> · Adresse du compte : <span style={{overflowWrap:'anywhere'}}>{settings.recipient}</span></p>
  {!settings.configured&&<p>Le service e-mail n’est pas encore connecté. L’activation sera disponible après sa configuration.</p>}
  {!settings.verified&&<p>Vérifiez votre adresse depuis <a href="/compte/securite">la sécurité du compte</a> pour activer les rappels.</p>}
  <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
   <button className={styles.billingButton} type="button" disabled={busy||!settings.enabled&&(!settings.configured||!settings.verified)} onClick={()=>update()}>{settings.enabled?'Désactiver les rappels':'Activer les rappels'}</button>
   <button className={styles.billingButton} type="button" disabled={busy} onClick={()=>update(true)}>Actualiser l’état</button>
  </div>
  <p role="status" aria-live="polite">{message}</p>
  <p>Un renouvellement annule les rappels devenus inutiles avant leur envoi. Un message déjà en cours peut encore arriver. Ces rappels ne déclenchent aucun débit.</p>
  {settings.jobs.length>0&&<details><summary>Dernières tentatives</summary><ul>{settings.jobs.map(job=><li key={job.id}>
   <time dateTime={job.createdAt}>{new Date(job.createdAt).toLocaleString('fr-TN')}</time> · {status[job.status]||'Indisponible'} · {job.attempts} tentative(s)
  </li>)}</ul><p>L’acceptation par le service e-mail ne garantit pas la réception dans votre boîte. Une reprise peut produire un doublon.</p></details>}
 </div>;
}
