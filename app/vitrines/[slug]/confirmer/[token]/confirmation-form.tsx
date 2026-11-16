'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';

const text={
 fr:{confirm:'✓ Je confirme ma commande',change:'Je veux modifier',cancel:'J’annule',note:'Que souhaitez-vous modifier ? (adresse, quantité, horaire…)',send:'Envoyer ma demande',sure:'Annuler définitivement cette commande ?',error:'Envoi impossible, réessayez.'},
 ar:{confirm:'✓ أؤكد طلبي',change:'أريد التعديل',cancel:'أُلغي الطلب',note:'ما الذي تريد تعديله؟ (العنوان، الكمية، الوقت…)',send:'إرسال الطلب',sure:'هل تريد إلغاء هذا الطلب نهائيا؟',error:'تعذر الإرسال، أعد المحاولة.'}
};
export default function ConfirmationForm({slug,token,lang}:{slug:string;token:string;lang:'fr'|'ar'}){
 const t=text[lang],router=useRouter();
 const [mode,setMode]=useState<'idle'|'change'>('idle'),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const requests=useRef<Record<string,string>>({});
 async function answer(value:'CONFIRMED'|'CHANGE'|'CANCELLED'){
  if(value==='CANCELLED'&&!window.confirm(t.sure))return;
  setBusy(true);setError('');
  requests.current[value]??=crypto.randomUUID();
  try{
   const response=await fetch('/api/v1/public/vitrines/'+encodeURIComponent(slug)+'/confirmer/'+encodeURIComponent(token),{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestId:requests.current[value],answer:value,...(value==='CHANGE'?{note}:{})})});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||t.error);
   router.refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:t.error);setBusy(false);}
 }
 return <section style={{display:'grid',gap:12}}>
  <button type="button" className="primary" disabled={busy} onClick={()=>void answer('CONFIRMED')} style={{fontSize:18,padding:'16px 18px'}}>{t.confirm}</button>
  {mode==='idle'?<div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
   <button type="button" className="button" disabled={busy} onClick={()=>setMode('change')}>{t.change}</button>
   <button type="button" className="button" disabled={busy} onClick={()=>void answer('CANCELLED')}>{t.cancel}</button>
  </div>:<div style={{display:'grid',gap:8}}>
   <label style={{display:'grid',gap:6}}>{t.note}<textarea value={note} maxLength={500} rows={3} onChange={e=>setNote(e.target.value)} dir="auto" style={{padding:10,borderRadius:8,border:'1px solid #cfdde3'}}/></label>
   <button type="button" className="button" disabled={busy||note.trim().length<5} onClick={()=>void answer('CHANGE')}>{t.send}</button>
  </div>}
  {error&&<p role="alert" style={{color:'#a3341d',margin:0}}>{error}</p>}
 </section>;
}
