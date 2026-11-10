'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {CheckCircle2,ShieldAlert,Save,WalletCards} from 'lucide-react';
import {receptionLabel,receptionCode,type ReceptionCode} from '../../../modules/billing/reception-validation';
import styles from '../platform.module.css';

export type MethodConfig={
 code:string;enabled:boolean;recipientName:string;identifier:string;
 bankName:string;instructions:string;version:number;updatedAt:string
};

function MethodEditor({initial}:{initial:MethodConfig}){
 const [settings,setSettings]=useState(initial);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const router=useRouter();
 const code=receptionCode.parse(settings.code);
 function field(key:'recipientName'|'identifier'|'bankName'|'instructions',value:string){
  setSettings(prev=>({...prev,[key]:value}));setSuccess('');
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(busy)return;
  if(settings.enabled&&!window.confirm('Vous confirmez que ces coordonnées sont OFFICIELLES et peuvent être communiquées aux commerçants de Tunicom ?'))return;
  setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/admin/payment-reception',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     code:settings.code,version:settings.version,enabled:settings.enabled,
     recipientName:settings.recipientName,identifier:settings.identifier,
     bankName:settings.bankName,instructions:settings.instructions
    })
   });
   const data=await response.json() as {error?:string;method?:MethodConfig};
   if(!response.ok||!data.method)throw new Error(data.error||'Enregistrement impossible');
   setSettings({...data.method,updatedAt:String(data.method.updatedAt)});
   setSuccess(settings.enabled?'Méthode disponible aux marchands.':'Méthode désactivée pour les nouvelles demandes.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Erreur');}
  finally{setBusy(false);}
 }
 return <form onSubmit={e=>void save(e)} className={styles.receptionCard}>
  <header className={styles.receptionHeader}>
   <div><h2><WalletCards size={19}/>{receptionLabel(code)}</h2>
    <p>{code==='D17'?'Numéro D17 officiel du bénéficiaire':
     code==='BANK_TRANSFER'?'Coordonnées bancaires du compte bénéficiaire':
     'Point et modalités de remise des espèces'}</p></div>
   <span className={settings.enabled?styles.success:styles.waiting}>{settings.enabled?'Activé':'Désactivé'}</span>
  </header>
  <label className={styles.receptionSwitch}>
   <input type="checkbox" checked={settings.enabled}
    onChange={e=>setSettings(prev=>({...prev,enabled:e.target.checked}))}/>
   Autoriser les déclarations par {receptionLabel(code)}
  </label>
  <div className={styles.receptionFields}>
   <label>Nom officiel du bénéficiaire
    <input value={settings.recipientName} maxLength={120}
     onChange={e=>field('recipientName',e.target.value)}
     placeholder="Nom légal ou entreprise (à renseigner)"/>
   </label>
   {code==='BANK_TRANSFER'&&<label>Nom de la banque
    <input value={settings.bankName} maxLength={100}
     onChange={e=>field('bankName',e.target.value)} placeholder="Banque du compte officiel"/>
   </label>}
   {code!=='CASH'&&<label>{code==='D17'?'Numéro D17 du bénéficiaire':'RIB ou IBAN du bénéficiaire'}
    <input value={settings.identifier} maxLength={100}
     onChange={e=>field('identifier',e.target.value)}
     placeholder={code==='D17'?'Numéro D17 exact':'RIB / IBAN exact'}/>
   </label>}
   <label className={styles.receptionWide}>Instructions communiquées au marchand
    <textarea value={settings.instructions} maxLength={1000} rows={4}
     onChange={e=>field('instructions',e.target.value)}
     placeholder={code==='CASH'?'Adresse de remise, personne habilitée et horaires':
      'Étapes du transfert, bénéficiaire, montant exact et référence à conserver'}/>
   </label>
  </div>
  <div className={styles.receptionFooter}>
   <small>Version {settings.version} · Modification enregistrée le {new Date(settings.updatedAt).toLocaleString('fr-TN')}</small>
   <button className={styles.primary} type="submit" disabled={busy}>
    <Save size={15}/>{busy?'Enregistrement…':'Enregistrer la méthode'}
   </button>
  </div>
  {error&&<p role="alert" className={styles.inlineError}>{error}</p>}
  {success&&<p role="status" className={styles.inlineSuccess}><CheckCircle2 size={17}/>{success}</p>}
 </form>;
}
export default function PaymentSettings({methods}:{methods:MethodConfig[]}){
 return <>
  <div className={styles.receptionNotice}>
   <ShieldAlert size={20}/>
   <div>
    <strong>Sécurité des coordonnées de réception</strong>
    <p>Seuls les comptes officiels que vous avez contrôlés doivent être activés. Les champs restent vides tant que vous ne les configurez pas. Ces coordonnées seront visibles par les marchands authentifiés ; aucune donnée de carte ni clé API ne doit y être inscrite.</p>
   </div>
  </div>
  <div className={styles.receptionGrid}>
   {methods.map(method=><MethodEditor key={method.code} initial={method}/>)}
  </div>
 </>;
}
