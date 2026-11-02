'use client';

import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {Banknote,CheckCircle2,Clock3,ReceiptText,ShieldAlert} from 'lucide-react';
import {paymentMethodLabel,paymentStatusLabel,toTnd} from '../../modules/billing/validation';
import {receptionCode,type ReceptionPublic} from '../../modules/billing/reception';
import styles from './plan.module.css';

export type PaymentOffer={
 code:string;name:string;description:string;priceMillimes:number;durationDays:number
};
export type PaymentHistory={
 id:string;reference:string;planName:string;planCode:string;
 priceMillimes:number;durationDays:number;method:string;
 transferReference:string|null;status:string;
 merchantNote:string;adminNote:string;
 periodStartsAt:string|null;periodEndsAt:string|null;
 createdAt:string;decidedAt:string|null
};
export default function SubscriptionBilling({
 plans,history,methods
}:{plans:PaymentOffer[];history:PaymentHistory[];methods:ReceptionPublic[]}){
 const router=useRouter();
 const [selected,setSelected]=useState(plans[0]?.code||'');
 const [method,setMethod]=useState(methods[0]?.code||'');
 const [reference,setReference]=useState('');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const requestId=useRef('');
 const pending=history.some(r=>r.status==='PENDING');
 const plan=plans.find(p=>p.code===selected);
 const available=methods.find(p=>p.code===method)||methods[0];

 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(busy||pending||!available)return;
  setBusy(true);setError('');setSuccess('');
  if(!requestId.current)requestId.current=crypto.randomUUID();
  try{
   const response=await fetch('/api/v1/subscription-payments',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({
     requestId:requestId.current,planCode:selected,method:available.code,
     transferReference:available.code==='CASH'?'':reference,
     merchantNote:note
    })
   });
   const payload=await response.json() as {error?:string,payment?:{reference:string}};
   if(!response.ok)throw new Error(payload.error||'Déclaration indisponible');
   requestId.current='';
   setSuccess('Demande '+payload.payment?.reference+' transmise. Votre abonnement reste inchangé tant que le paiement n’est pas validé.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible');}
  finally{setBusy(false);}
 }

 return <div className={styles.billingLayout}>
  <section className={styles.card}>
   <h2><Banknote size={20}/> Déclarer un règlement</h2>
   <p>Cette démarche permet de <strong>signaler un paiement réalisé en dehors de TuniCommerce</strong>. Elle ne débite pas de compte et ne confirme aucun transfert automatiquement.</p>
   {!plans.length?<div className={styles.billingWarning}><ShieldAlert size={17}/> Aucun tarif payant n'est encore configuré. Contactez l'administration pour un renouvellement manuel.</div>:
    pending?<div className={styles.billingWarning}><Clock3 size={17}/> Une déclaration est déjà en attente. L'administration doit la traiter avant une autre demande.</div>:
    !available?<div className={styles.billingWarning}><ShieldAlert size={17}/> Aucun moyen de paiement officiel n'est encore activé. Aucun transfert ne doit être effectué sur la base d'informations non vérifiées ; contactez l'administration.</div>:
    <form className={styles.billingForm} onSubmit={e=>void submit(e)}>
     <label>Offre demandée
      <select value={selected} onChange={e=>{setSelected(e.target.value);requestId.current='';}}>
       {plans.map(p=><option key={p.code} value={p.code}>{p.name} — {toTnd(p.priceMillimes)} / {p.durationDays} jours</option>)}
      </select>
     </label>
     {plan&&<div className={styles.billingPrice}><strong>{toTnd(plan.priceMillimes)}</strong><span>{plan.durationDays} jours · Tarif enregistré lors de la déclaration</span></div>}
     <label>Moyen de règlement officiellement disponible
      <select value={available.code} onChange={e=>{setMethod(receptionCode.parse(e.target.value));requestId.current='';}}>
       {methods.map(m=><option key={m.code} value={m.code}>{paymentMethodLabel(m.code)}</option>)}
      </select>
     </label>
     <div className={styles.billingDestination} role="region" aria-label="Coordonnées de réception officielles">
      <strong>Coordonnées de réception communiquées par TuniCommerce</strong>
      <dl>
       <dt>Bénéficiaire</dt><dd>{available.recipientName}</dd>
       {available.code==='BANK_TRANSFER'&&<><dt>Banque</dt><dd>{available.bankName}</dd></>}
       {available.code!=='CASH'&&<><dt>{available.code==='D17'?'Numéro D17':'RIB ou IBAN'}</dt><dd>{available.identifier}</dd></>}
      </dl>
      <p>{available.instructions}</p>
      <small>Avant de transférer de l'argent, vérifiez l'identité du bénéficiaire et le montant exact. TuniCommerce ne vérifie pas automatiquement la réception des fonds.</small>
     </div>
     {available.code!=='CASH'&&<label>Référence de la transaction
      <input required minLength={6} maxLength={120} value={reference}
       onChange={e=>{setReference(e.target.value);requestId.current='';}}
       placeholder="Référence figurant sur le justificatif de transfert"/>
     </label>}
     <label>Commentaire (facultatif)
      <textarea maxLength={500} rows={3} value={note}
       onChange={e=>{setNote(e.target.value);requestId.current='';}}
       placeholder="Date du transfert, information de rapprochement…"/>
     </label>
     <p className={styles.billingWarning}>Ce formulaire déclare un règlement externe. Il n'exécute aucun transfert. Le renouvellement nécessite la vérification et l'approbation de l'administrateur.</p>
     {error&&<p role="alert" className={styles.billingError}>{error}</p>}
     {success&&<p role="status" className={styles.billingSuccess}>{success}</p>}
     <button type="submit" disabled={busy||!selected||!available} className={styles.billingButton}>
      <ReceiptText size={17}/>{busy?'Enregistrement…':'Envoyer la déclaration pour vérification'}
     </button>
    </form>}
   {error&&pending&&<p role="alert" className={styles.billingError}>{error}</p>}
   {success&&pending&&<p role="status" className={styles.billingSuccess}>{success}</p>}
  </section>
  <section className={styles.card}>
   <h2><ReceiptText size={20}/> Historique des demandes</h2>
   <p>Les documents ci-dessous sont des demandes et confirmations de gestion, <strong>pas des factures fiscales tunisiennes</strong>.</p>
   {!history.length?<p className={styles.billingEmpty}>Aucune déclaration enregistrée.</p>:
   <div className={styles.paymentHistory}>{history.map(payment=><article key={payment.id} className={styles.paymentItem}>
    <div className={styles.paymentTop}>
     <strong>{payment.planName} · {toTnd(payment.priceMillimes)}</strong>
     <span className={payment.status==='APPROVED'?styles.billingApproved:payment.status==='REJECTED'?styles.billingRejected:styles.billingPending}>
      {payment.status==='APPROVED'&&<CheckCircle2 size={13}/>}
      {paymentStatusLabel(payment.status)}
     </span>
    </div>
    <small>{payment.reference} · {new Date(payment.createdAt).toLocaleString('fr-TN')} · {paymentMethodLabel(payment.method)}</small>
    {payment.status==='APPROVED'&&payment.periodEndsAt&&<small>Abonnement prolongé jusqu'au {new Date(payment.periodEndsAt).toLocaleDateString('fr-TN')}</small>}
    {payment.status==='REJECTED'&&<small>Motif : {payment.adminNote}</small>}
    <a href={'/mon-abonnement/justificatif/'+payment.id} className={styles.paymentDocument}>Consulter le document et l'imprimer</a>
   </article>)}</div>}
  </section>
 </div>;
}
