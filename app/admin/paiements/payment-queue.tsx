'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Search,CheckCircle2,XCircle,ExternalLink,ReceiptText} from 'lucide-react';
import {paymentMethodLabel,paymentStatusLabel,toTnd} from '../../../modules/billing/validation';
import styles from '../platform.module.css';

export type AdminPaymentRow={
 id:string;reference:string;workspaceId:string;slug:string|null;
 ownerName:string;ownerEmail:string;planCode:string;planName:string;
 priceMillimes:number;durationDays:number;method:string;
 transferReference:string|null;merchantNote:string;
 status:string;adminNote:string;createdAt:string;
 decidedAt:string|null;periodEndsAt:string|null
};

export default function AdminPaymentQueue({
 payments,total
}:{payments:AdminPaymentRow[];total:number}){
 const router=useRouter();
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState('PENDING');
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [working,setWorking]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const visible=useMemo(()=>payments.filter(row=>{
  if(status!=='ALL'&&row.status!==status)return false;
  return [row.reference,row.ownerEmail,row.ownerName,row.slug||'',row.planName,
   row.transferReference||''].join(' ').toLowerCase().includes(query.trim().toLowerCase());
 }),[payments,status,query]);

 async function decide(row:AdminPaymentRow,action:'approve'|'reject'){
  if(working)return;
  const adminNote=(notes[row.id]||'').trim();
  if(action==='reject'&&adminNote.length<5){
   setError('Précisez le motif du refus (5 caractères minimum).');return;
  }
  if(action==='approve'){
   const confirmed=window.confirm(
    'Avez-vous vérifié EXTERNEMENT la réception de '+toTnd(row.priceMillimes)+
    ' pour la référence '+(row.transferReference||'espèces')+' ? Valider prolongera immédiatement l’abonnement de '+row.durationDays+' jours.'
   );
   if(!confirmed)return;
  }else if(!window.confirm('Refuser cette déclaration ? Le commerçant pourra en soumettre une nouvelle.'))return;
  setWorking(row.id);setError('');setSuccess('');
  try{
   const response=await fetch('/api/admin/subscription-payments',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id:row.id,action,adminNote})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Décision non enregistrée');
   setSuccess('Décision enregistrée pour le dossier '+row.reference+'.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Erreur de validation');}
  finally{setWorking(null);}
 }
 return <section className={styles.panel}>
  <div className={styles.panelHead}><div><h2>Déclarations des commerçants</h2>
   <p>Les 200 dossiers les plus récents sont affichés ; le nombre total est calculé sur toute la base.</p>
  </div></div>
  <div className={styles.filters}>
   <label className={styles.searchBox}><Search size={16}/>
    <input aria-label="Rechercher un règlement" value={query} onChange={e=>setQuery(e.target.value)}
     placeholder="Marchand, référence, offre, boutique"/>
   </label>
   <select className={styles.simpleSelect} value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filtrer les règlements">
    <option value="PENDING">À vérifier</option>
    <option value="APPROVED">Validés</option>
    <option value="REJECTED">Refusés</option>
    <option value="ALL">Tous</option>
   </select>
  </div>
  {error&&<div className={styles.inlineError} role="alert">{error}</div>}
  {success&&<div className={styles.inlineSuccess} role="status">{success}</div>}
  <div className={styles.paymentQueue}>
   {visible.map(row=><article key={row.id} className={styles.paymentCase}>
    <div className={styles.paymentCaseTop}>
     <div>
      <strong>{row.reference}</strong>
      <small>{new Date(row.createdAt).toLocaleString('fr-TN')} · {paymentStatusLabel(row.status)}</small>
     </div>
     <span>{toTnd(row.priceMillimes)}</span>
    </div>
    <div className={styles.paymentCaseGrid}>
     <div><small>Boutique et propriétaire</small><strong>{row.slug||'Sans lien public'}</strong><span>{row.ownerName} · {row.ownerEmail}</span></div>
     <div><small>Offre</small><strong>{row.planName} ({row.planCode})</strong><span>{row.durationDays} jours, montant figé au dépôt</span></div>
     <div><small>Moyen de règlement</small><strong>{paymentMethodLabel(row.method)}</strong><span>Référence déclarée : {row.transferReference||'Remise d’espèces déclarée'}</span></div>
    </div>
    {row.merchantNote&&<p className={styles.paymentNote}><strong>Commentaire marchand : </strong>{row.merchantNote}</p>}
    {row.status==='PENDING'?<div className={styles.paymentActions}>
     <label>Note administrative / motif de refus
      <textarea value={notes[row.id]||''} onChange={e=>setNotes(v=>({...v,[row.id]:e.target.value}))}
       rows={2} maxLength={500} placeholder="Montant vérifié, correspondance de référence ou motif du refus"/>
     </label>
     <div>
      <button type="button" disabled={!!working} className={styles.primary}
       onClick={()=>void decide(row,'approve')}>
       <CheckCircle2 size={15}/>{working===row.id?'Traitement…':'Valider le paiement'}
      </button>
      <button type="button" disabled={!!working} className={styles.secondary}
       onClick={()=>void decide(row,'reject')}><XCircle size={15}/> Refuser</button>
      <Link className={styles.action} href={'/admin/boutiques/'+row.workspaceId}>Fiche boutique <ExternalLink size={14}/></Link>
     </div>
    </div>:<div className={styles.paymentFinal}>
     <span><ReceiptText size={15}/>{row.status==='APPROVED'&&row.periodEndsAt?'Renouvelé jusqu’au '+new Date(row.periodEndsAt).toLocaleDateString('fr-TN'):'Déclaration refusée'}</span>
     {row.adminNote&&<p>Note : {row.adminNote}</p>}
     <Link href={'/admin/boutiques/'+row.workspaceId} className={styles.action}>Fiche boutique <ExternalLink size={14}/></Link>
    </div>}
   </article>)}
   {!visible.length&&<div className={styles.empty}><ReceiptText size={29}/><strong>Aucun règlement dans cette sélection</strong><p>Les nouvelles déclarations des commerçants apparaîtront ici.</p></div>}
  </div>
  <div className={styles.listFooter}>{visible.length} dossier(s) affiché(s), {payments.length} chargés sur {total} au total.</div>
 </section>;
}
