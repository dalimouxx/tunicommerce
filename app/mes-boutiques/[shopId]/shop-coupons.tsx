'use client';
import {useEffect,useState,type FormEvent} from 'react';
type Coupon={id:string;code:string;percent:number;used:number;limit:number;remaining:number;active:boolean};
export default function ShopCoupons({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/coupons';
 const [coupons,setCoupons]=useState<Coupon[]>([]);
 const [code,setCode]=useState('');
 const [percent,setPercent]=useState('10');
 const [limit,setLimit]=useState('50');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json() as {coupons?:Coupon[];error?:string};
   if(!response.ok)throw Error(data.error||'Coupons indisponibles');
   if(!controller.signal.aborted)setCoupons(data.coupons||[]);
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url]);
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'coupon',requestId:crypto.randomUUID(),
     payload:{code:code.trim().toUpperCase(),percent:Number(percent),limit:Number(limit)}})});
   const data=await response.json() as {coupons?:Coupon[];error?:string};
   if(!response.ok)throw Error(data.error||'Coupon refusé');
   setCoupons(data.coupons||[]);setCode('');setNotice('Code créé et utilisable au checkout COD de cette boutique.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau');}
  finally{setBusy(false);}
 }
 return <section style={{background:'white',border:'1px solid #dce6ed',padding:22,borderRadius:16,marginTop:16}}>
  <h2>Promotions · Codes de réduction</h2>
  <p>Créez des coupons avec un pourcentage et un nombre maximal d'utilisations. Les codes s'appliquent uniquement aux produits de cette boutique et sont vérifiés au serveur.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement…</p>:<>
   <form onSubmit={e=>void create(e)} style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap',margin:'16px 0'}}>
    <label>Code<input required minLength={2} maxLength={30} pattern="[A-Za-z0-9_-]+" value={code} onChange={e=>setCode(e.target.value)} placeholder="BIENVENUE10" style={{display:'block',padding:9}}/></label>
    <label>Réduction (%)<input required type="number" min="1" max="70" step="1" value={percent} onChange={e=>setPercent(e.target.value)} style={{display:'block',padding:9,width:105}}/></label>
    <label>Utilisations maximales<input required type="number" min="1" max="100000" step="1" value={limit} onChange={e=>setLimit(e.target.value)} style={{display:'block',padding:9,width:125}}/></label>
    <button type="submit" disabled={busy}>Créer mon code</button>
   </form>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
    <thead><tr><th>Code</th><th>Réduction</th><th>Utilisées</th><th>Restantes</th><th>Statut</th></tr></thead>
    <tbody>{coupons.map(c=><tr key={c.id} style={{borderTop:'1px solid #e3ebed'}}>
     <td style={{padding:9}}><strong>{c.code}</strong></td><td style={{padding:9}}>{c.percent}%</td>
     <td style={{padding:9}}>{c.used}/{c.limit}</td><td style={{padding:9}}>{c.remaining}</td>
     <td style={{padding:9}}>{c.active&&c.remaining>0?'Utilisable':'Épuisé / inactif'}</td>
    </tr>)}</tbody></table>{coupons.length===0&&<p>Aucun coupon défini.</p>}</div>
  </>}
 </section>;
}
