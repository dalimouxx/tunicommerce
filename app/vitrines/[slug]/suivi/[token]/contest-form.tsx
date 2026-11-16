'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
/** Contest a recorded refusal; the refusal stops counting until the Super Admin decides. */
export default function ContestForm({slug,token}:{slug:string;token:string}){
 const router=useRouter();
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function send(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/v1/public/vitrines/'+encodeURIComponent(slug)+'/suivi/'+encodeURIComponent(token)+'/contestation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'Envoi impossible');
   router.refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:'Envoi impossible');setBusy(false);}
 }
 return <div style={{display:'grid',gap:8}}>
  <label style={{display:'grid',gap:6}}>Pourquoi contestez-vous ce refus ? (par exemple : jamais contacté par le livreur, absent au moment prévu…)
   <textarea value={reason} maxLength={500} rows={3} onChange={e=>setReason(e.target.value)} style={{padding:10,borderRadius:8,border:'1px solid #cfdde3'}}/></label>
  <button type="button" className="button" disabled={busy||reason.trim().length<10} onClick={()=>void send()}>Contester ce refus</button>
  {error&&<p role="alert" style={{color:'#a3341d',margin:0}}>{error}</p>}
 </div>;
}
