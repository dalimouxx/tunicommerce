'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';

export default function CustomerRequestForm({slug,token,canCancel,canReturn}:{
 slug:string;token:string;canCancel:boolean;canReturn:boolean
}){
 const router=useRouter();
 const [kind,setKind]=useState<'CANCEL'|'RETURN'>(canCancel?'CANCEL':'RETURN');
 const [reason,setReason]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const requestId=useRef<string|null>(null);
 const eligible=[...(canCancel?['CANCEL' as const]:[]),...(canReturn?['RETURN' as const]:[])];
 if(eligible.length===0)return null;
 const selected=eligible.includes(kind)?kind:eligible[0];
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const id=requestId.current||crypto.randomUUID();
  requestId.current=id;setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/v1/public/vitrines/'+encodeURIComponent(slug)+
    '/suivi/'+encodeURIComponent(token)+'/requests',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id,type:selected,reason})
   });
   const result=await response.json() as {accepted?:boolean;alreadyApplied?:boolean;error?:string};
   if(!response.ok||!result.accepted)throw Error(result.error||'Demande non enregistrée');
   setNotice(result.alreadyApplied?'Demande déjà reçue, sans doublon.':
    'Votre demande est enregistrée et attend la décision du marchand.');
   setReason('');requestId.current=null;router.refresh();
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau : réessayez sans modifier la demande.');}
  finally{setBusy(false);}
 }
 return <section style={{background:'white',padding:20,border:'1px solid #dbe5eb',borderRadius:16,marginTop:16}}>
  <h2>Demander une annulation ou un retour</h2>
  <p>Cette demande ne modifie pas automatiquement la commande. Le marchand doit la vérifier et prendre une décision.</p>
  <form onSubmit={event=>void submit(event)} style={{display:'grid',gap:12,maxWidth:480}}>
   <label>Type de demande
    <select value={selected} onChange={event=>{setKind(event.target.value as 'CANCEL'|'RETURN');requestId.current=null;}}
     style={{display:'block',width:'100%',padding:10}}>
     {canCancel&&<option value="CANCEL">Demander l’annulation</option>}
     {canReturn&&<option value="RETURN">Demander un retour</option>}
    </select>
   </label>
   <label>Motif
    <textarea required minLength={5} maxLength={500} rows={3} value={reason}
     onChange={event=>{setReason(event.target.value);requestId.current=null;}}
     style={{display:'block',width:'100%',padding:10}}/>
   </label>
   <button type="submit" disabled={busy||reason.trim().length<5}
    style={{padding:12,background:'#126c65',color:'white',border:0,borderRadius:10,fontWeight:700}}>
    {busy?'Enregistrement…':'Envoyer ma demande'}
   </button>
  </form>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
 </section>;
}
