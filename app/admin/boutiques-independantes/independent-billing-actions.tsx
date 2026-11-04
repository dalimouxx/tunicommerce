'use client';
import {useState,type FormEvent} from 'react';

type Props={shopId:string;plan:string;status:string;plans:string[];owner:string};
export default function IndependentBillingActions({shopId,plan,status,plans,owner}:Props){
 const [nextPlan,setNextPlan]=useState(plan);
 const [nextStatus,setNextStatus]=useState(status);
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!window.confirm('Modifier le compte de '+owner+' ? Ce changement concerne toutes ses boutiques. Il ne crée aucun règlement et ne prolonge pas l’échéance.'))return;
  setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/admin/independent-shop-billing',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({shopId,expectedPlan:plan,expectedStatus:status,
     plan:nextPlan,status:nextStatus,reason,acknowledgeManualChange:true})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error||'Modification refusée');
   window.location.reload();
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau');}
  finally{setBusy(false);}
 }
 return <details style={{minWidth:240}}>
  <summary>Gérer le compte SaaS</summary>
  <form onSubmit={event=>void save(event)} style={{display:'grid',gap:8,padding:10}}>
   <label>Formule<select value={nextPlan} onChange={event=>setNextPlan(event.target.value)}>
    {[...new Set([...plans,plan])].map(code=><option key={code} value={code}>{code}</option>)}
   </select></label>
   <label>Statut<select value={nextStatus} onChange={event=>setNextStatus(event.target.value)}>
    <option value="TRIAL">Essai</option><option value="ACTIVE">Actif</option>
    <option value="SUSPENDED">Suspendu</option><option value="CANCELLED">Résilié</option>
   </select></label>
   <label>Motif de l'opération<textarea required minLength={12} maxLength={500} value={reason}
    onChange={event=>setReason(event.target.value)} rows={3} placeholder="Motif auditable de cette intervention"/></label>
   <button type="submit" disabled={busy||nextPlan===plan&&nextStatus===status}>
    {busy?'Enregistrement…':'Enregistrer sans paiement'}
   </button>
   {notice&&<p role="alert">{notice}</p>}
   <small>L'échéance n'est pas modifiée. Un renouvellement payant passe par la validation du règlement déclaré.</small>
  </form>
 </details>;
}
