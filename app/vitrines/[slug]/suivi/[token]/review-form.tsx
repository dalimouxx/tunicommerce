'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';

/** One verified review per delivered product; the server re-checks delivery and ownership of the link. */
export default function ReviewForm({slug,token,productId,productName}:{slug:string;token:string;productId:string;productName:string}){
 const router=useRouter();
 const [rating,setRating]=useState(0),[comment,setComment]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState(false),[busy,setBusy]=useState(false);
 const requestId=useRef<string|null>(null);
 async function submit(event:FormEvent){
  event.preventDefault();
  if(!rating){setError(true);setNotice('Choisissez une note de 1 à 5 étoiles.');return;}
  setBusy(true);setNotice('');setError(false);
  requestId.current??=crypto.randomUUID();
  try{
   const response=await fetch('/api/v1/public/vitrines/'+encodeURIComponent(slug)+'/suivi/'+encodeURIComponent(token)+'/avis',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestId:requestId.current,productId,rating,comment})});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error||'Envoi impossible');
   setNotice('Merci ! Votre avis est publié sur la page du produit.');router.refresh();
  }catch(cause){setError(true);setNotice(cause instanceof Error?cause.message:'Envoi impossible');requestId.current=null;}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} style={{display:'grid',gap:10,border:'1px solid #dce5eb',borderRadius:12,padding:14}} aria-label={'Avis sur '+productName}>
  <strong>{productName}</strong>
  <fieldset style={{border:0,padding:0,margin:0,display:'flex',gap:4}}>
   <legend style={{fontSize:13,marginBottom:6}}>Votre note</legend>
   {[1,2,3,4,5].map(star=><button key={star} type="button" aria-pressed={rating===star} aria-label={star+' étoile'+(star>1?'s':'')+' sur 5'} onClick={()=>setRating(star)}
    style={{fontSize:28,lineHeight:1,background:'none',border:0,cursor:'pointer',color:star<=rating?'#e2a400':'#b9c3c9',padding:2}}>★</button>)}
  </fieldset>
  <label style={{display:'grid',gap:6,fontSize:13}}>Votre avis (facultatif)
   <textarea value={comment} maxLength={1000} rows={3} onChange={event=>setComment(event.target.value)} placeholder="Qualité, livraison, conformité…" style={{padding:10,borderRadius:8,border:'1px solid #cfdde3'}}/>
  </label>
  <small>Publié avec votre prénom et l’initiale de votre nom, sans téléphone ni adresse. Les liens ne sont pas acceptés.</small>
  <button type="submit" className="primary" disabled={busy}>{busy?'Envoi…':'Publier mon avis'}</button>
  {notice&&<p role={error?'alert':'status'} style={{margin:0,color:error?'#a3341d':'#1b7a4b'}}>{notice}</p>}
 </form>;
}
