'use client';

import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {CheckCircle2,XCircle,ExternalLink,ReceiptText} from 'lucide-react';
import {paymentMethodLabel,paymentStatusLabel,toTnd} from '../../../modules/billing/validation';
import {subscriptionRenewalPeriod} from '../../../modules/billing/renewal';
import styles from '../platform.module.css';
const dateTime=(value:Date|string)=>(typeof value==='string'?new Date(value):value).toLocaleString('fr-TN',{timeZone:'Africa/Tunis'});
const dateOnly=(value:string)=>new Date(value).toLocaleDateString('fr-TN',{timeZone:'Africa/Tunis'});

export type AdminPaymentRow={
 id:string;reference:string;workspaceId:string;slug:string|null;
 ownerName:string;ownerEmail:string;planCode:string;planName:string;
 priceMillimes:number;durationDays:number;method:string;
 transferReference:string|null;merchantNote:string;
 status:string;adminNote:string;createdAt:string;
 decidedAt:string|null;periodEndsAt:string|null;periodStartsAt:string|null;
 currentPlan:string;currentStatus:string;currentEndsAt:string|null;ownerId:string
};

export default function AdminPaymentQueue({
 payments,total,asOf
}:{payments:AdminPaymentRow[];total:number;asOf:string}){
 const router=useRouter();
 const [confirmed,setConfirmed]=useState<Record<string,boolean>>({});
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [working,setWorking]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 function preview(row:AdminPaymentRow){
  try{return {period:subscriptionRenewalPeriod({plan:row.currentPlan,subscriptionStatus:row.currentStatus,
   subscriptionEndsAt:row.currentEndsAt?new Date(row.currentEndsAt):null},row.durationDays,new Date(asOf)),error:''};}
  catch(error){return {period:null,error:error instanceof Error?error.message:'Renouvellement indisponible'};}
 }

 async function decide(row:AdminPaymentRow,action:'approve'|'reject'){
  if(working)return;
  const adminNote=(notes[row.id]||'').trim();
  if(adminNote.length<5){
   setError('Précisez la vérification du règlement ou le motif du refus (5 caractères minimum).');return;
  }
  if(action==='approve'){
   if(!confirmed[row.id]){setError('Confirmez la réception des fonds avant de valider.');return;}
   if(preview(row).error){setError(preview(row).error);return;}
  }else if(!window.confirm('Refuser cette déclaration ? Le commerçant pourra en soumettre une nouvelle.'))return;
  setWorking(row.id);setError('');setSuccess('');
  try{
   const response=await fetch('/api/admin/subscription-payments',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id:row.id,action,adminNote,receivedConfirmed:action==='approve'&&confirmed[row.id]===true})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Décision non enregistrée');
   setSuccess('Décision enregistrée pour le dossier '+row.reference+'.');
   setConfirmed(values=>({...values,[row.id]:false}));
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Erreur de validation');}
  finally{setWorking(null);}
 }
 return <section className={styles.panel}>
  <div className={styles.panelHead}><div><h2>Déclarations des commerçants</h2>
   <p>Vérifiez les fonds reçus puis contrôlez la période créditée avant de prendre une décision.</p>
  </div></div>
  {error&&<div className={styles.inlineError} role="alert">{error}</div>}
  {success&&<div className={styles.inlineSuccess} role="status">{success}</div>}
  <div className={styles.paymentQueue}>
   {payments.map(row=>{const renewal=preview(row);return <article key={row.id} className={styles.paymentCase}>
    <div className={styles.paymentCaseTop}>
     <div>
      <strong>{row.reference}</strong>
      <small>{dateTime(row.createdAt)} (Tunisie) · {paymentStatusLabel(row.status)}</small>
     </div>
     <span>{toTnd(row.priceMillimes)}</span>
    </div>
    <div className={styles.paymentCaseGrid}>
     <div><small>Boutique et propriétaire</small><strong>{row.slug||'Sans lien public'}</strong><span><Link href={'/admin/marchands/'+row.ownerId}>{row.ownerName}</Link> · {row.ownerEmail}</span></div>
     <div><small>Offre</small><strong>{row.planName} ({row.planCode})</strong><span>{row.durationDays} jours, montant figé au dépôt</span></div>
     <div><small>Moyen de règlement</small><strong>{paymentMethodLabel(row.method)}</strong><span>Référence déclarée : {row.transferReference||'Remise d’espèces déclarée'}</span></div>
    </div>
    {row.merchantNote&&<p className={styles.paymentNote}><strong>Commentaire marchand : </strong>{row.merchantNote}</p>}
    {row.status==='PENDING'?<div className={styles.paymentActions}>
     <div className={styles.renewalPreview}>
      <strong>Effet de la validation</strong>
      <p>Compte actuel : {row.currentPlan} · {row.currentStatus} · échéance {row.currentEndsAt?dateTime(row.currentEndsAt):'non définie'}.</p>
      {renewal.period?<p>Période créditée estimée : du {dateTime(renewal.period.startAt)} au {dateTime(renewal.period.endsAt)} (heure de Tunisie). Les dates sont recalculées lors de la validation.</p>:
       <p role="status">{renewal.error}</p>}
      {row.currentPlan!==row.planCode&&<p>L’offre {row.planCode} s’appliquera immédiatement à toutes les boutiques du marchand. Les jours encore valides sont conservés sans prorata de prix.</p>}
     </div>
     <label>Vérification du règlement / motif de refus (obligatoire)
      <textarea value={notes[row.id]||''} onChange={e=>setNotes(v=>({...v,[row.id]:e.target.value}))}
       disabled={!!working} rows={2} minLength={5} maxLength={500} placeholder="Montant vérifié, correspondance de référence ou motif du refus"/>
     </label>
     <label className={styles.paymentVerification}>
      <input type="checkbox" checked={confirmed[row.id]||false} disabled={!!working||!!renewal.error}
       onChange={event=>setConfirmed(values=>({...values,[row.id]:event.target.checked}))}/>
      J’ai vérifié la réception de {toTnd(row.priceMillimes)} et la référence {row.transferReference||'du reçu d’espèces'} dans mes justificatifs externes.
     </label>
     <div>
      <button type="button" disabled={!!working||!confirmed[row.id]||!!renewal.error||(notes[row.id]||'').trim().length<5} className={styles.primary}
       onClick={()=>void decide(row,'approve')}>
       <CheckCircle2 size={15}/>{working===row.id?'Traitement…':'Valider le paiement'}
      </button>
      <button type="button" disabled={!!working} className={styles.secondary}
       onClick={()=>void decide(row,'reject')}><XCircle size={15}/> Refuser</button>
      <Link className={styles.action} href={'/admin/boutiques/'+row.workspaceId}>Fiche boutique <ExternalLink size={14}/></Link>
     </div>
    </div>:<div className={styles.paymentFinal}>
     <span><ReceiptText size={15}/>{row.status==='APPROVED'&&row.periodEndsAt?'Période créditée '+(row.periodStartsAt?'du '+dateOnly(row.periodStartsAt)+' ':'')+'jusqu’au '+dateOnly(row.periodEndsAt):'Déclaration refusée'}</span>
     {row.decidedAt&&<small>Décision du {dateTime(row.decidedAt)} (Tunisie)</small>}
     {row.adminNote&&<p>Note : {row.adminNote}</p>}
     <Link href={'/admin/boutiques/'+row.workspaceId} className={styles.action}>Fiche boutique <ExternalLink size={14}/></Link>
    </div>}
   </article>;})}
   {!payments.length&&<div className={styles.empty}><ReceiptText size={29}/><strong>Aucun règlement dans cette sélection</strong><p>Modifiez les critères pour consulter les autres dossiers.</p></div>}
  </div>
  <div className={styles.listFooter}>{payments.length} dossier(s) affiché(s) sur {total} résultat(s).</div>
 </section>;
}
