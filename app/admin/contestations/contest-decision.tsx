'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function ContestDecision({id}:{id:string}){
 const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function decide(decision:'ACCEPTED'|'REJECTED'){
  setBusy(true);setError('');
  const response=await fetch('/api/admin/reliability-contests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,decision})});
  const data=await response.json() as {error?:string};
  if(!response.ok)setError(data.error||'Décision impossible');else router.refresh();
  setBusy(false);
 }
 return <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
  <button type="button" className="primary" disabled={busy} onClick={()=>void decide('ACCEPTED')}>Retirer le refus</button>
  <button type="button" className="button" disabled={busy} onClick={()=>void decide('REJECTED')}>Maintenir le refus</button>
  {error&&<small role="alert">{error}</small>}
 </div>;
}
