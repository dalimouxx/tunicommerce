'use client';
import {useEffect,useState} from 'react';

type Review={id:string;productId:string;rating:number;comment:string;authorName:string;merchantReply:string|null;createdAt:string;status:'PUBLISHED'|'REPORTED'|'REMOVED';reportReason:string|null};
type Data={summary:{count:number;average:number};items:Review[]};
const reasons=[['ABUSE','Propos injurieux ou abusifs'],['PERSONAL_DATA','Données personnelles'],['OFF_TOPIC','Hors sujet']] as const;
const statusLabel={PUBLISHED:'Publié',REPORTED:'Signalé · masqué en attente du Super Admin',REMOVED:'Retiré par le Super Admin'};

function ReviewItem({review,send}:{review:Review;send:(body:object)=>Promise<string|null>}){
 const [reply,setReply]=useState(review.merchantReply||''),[reason,setReason]=useState<string>('ABUSE'),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function run(body:object,ok:string){setBusy(true);setNotice('');const error=await send(body);setNotice(error||ok);setBusy(false);}
 return <article style={{border:'1px solid #e1e9e4',borderRadius:12,padding:14,display:'grid',gap:8}}>
  <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
   <span aria-label={'Note '+review.rating+' sur 5'} style={{color:'#e2a400'}}>{'★'.repeat(review.rating)+'☆'.repeat(5-review.rating)}</span>
   <strong>{review.authorName}</strong><small>Produit {review.productId} · {new Date(review.createdAt).toLocaleDateString('fr-TN')}</small>
   <small style={{fontWeight:700,color:review.status==='PUBLISHED'?'#1b7a4b':'#a3341d'}}>{statusLabel[review.status]}</small>
  </div>
  {review.comment&&<p dir="auto" style={{margin:0,whiteSpace:'pre-line'}}>{review.comment}</p>}
  {review.status!=='REMOVED'&&<label style={{display:'grid',gap:4,fontSize:13}}>Réponse publique de la boutique
   <textarea value={reply} maxLength={600} rows={2} onChange={e=>setReply(e.target.value)} style={{padding:9,borderRadius:8,border:'1px solid #cfdde3'}}/></label>}
  {review.status!=='REMOVED'&&<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
   <button type="button" className="primary" disabled={busy} onClick={()=>void run({action:'reply',reviewId:review.id,reply},reply?'Réponse publiée.':'Réponse retirée.')}>{review.merchantReply?'Modifier la réponse':'Publier la réponse'}</button>
   {review.status==='PUBLISHED'&&<>
    <select value={reason} onChange={e=>setReason(e.target.value)} aria-label="Motif du signalement" style={{padding:8,borderRadius:8}}>{reasons.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <button type="button" className="button" disabled={busy} onClick={()=>void run({action:'report',reviewId:review.id,reason},'Avis signalé : il est masqué jusqu’à la décision du Super Admin.')}>Signaler un abus</button>
   </>}
  </div>}
  {notice&&<p role="status" style={{margin:0,fontSize:13}}>{notice}</p>}
 </article>;
}

export default function ShopReviews({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/reviews';
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{signal:controller.signal}).then(async response=>{const body=await response.json() as Data&{error?:string};if(!response.ok)throw Error(body.error||'Avis indisponibles');setData(body);})
   .catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Avis indisponibles');});
  return ()=>controller.abort();
 },[url]);
 async function send(body:object){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json() as Data&{error?:string};
  if(!response.ok)return result.error||'Action impossible';
  setData(result);return null;
 }
 return <section className="card" style={{padding:20,display:'grid',gap:14}} aria-labelledby="reviews-admin-title">
  <div><h2 id="reviews-admin-title">Avis clients</h2>
   <p style={{color:'#5b6b62',lineHeight:1.6}}>Les avis viennent uniquement de clients livrés (lien de suivi) et sont publiés directement avec le badge « Achat vérifié ». Vous pouvez répondre publiquement. Un avis abusif peut être signalé : il est masqué jusqu’à la décision du Super Admin. Un avis négatif mais honnête reste visible ; une réponse soignée rassure davantage qu’un avis caché.</p>
   {data&&data.summary.count>0&&<p><b>{data.summary.average.toFixed(1).replace('.',',')} / 5</b> · {data.summary.count} avis publiés</p>}</div>
  {error&&<p role="alert">{error}</p>}
  {!data&&!error&&<p>Chargement des avis…</p>}
  {data&&data.items.length===0&&<p>Aucun avis pour le moment. Ils apparaîtront après la livraison de vos commandes.</p>}
  {data?.items.map(review=><ReviewItem key={review.id+review.status+(review.merchantReply||'')} review={review} send={send}/>)}
 </section>;
}
