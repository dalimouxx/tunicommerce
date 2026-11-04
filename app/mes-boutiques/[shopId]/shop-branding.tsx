'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
type Branding={name:string;description:string;phone:string;address:string;shipping:number;logoUrl:string;bannerUrl:string};
export default function ShopBranding({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/branding';
 const [brand,setBrand]=useState<Branding|null>(null);
 const [shippingTnd,setShippingTnd]=useState('0');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const pending=useRef<{key:string;requestId:string}|null>(null);
 useEffect(()=>{
  const ctrl=new AbortController();
  fetch(url,{cache:'no-store',signal:ctrl.signal}).then(async response=>{
   const data=await response.json() as Branding&{error?:string};
   if(!response.ok)throw Error(data.error||'Vitrine indisponible');
   if(!ctrl.signal.aborted){setBrand(data);setShippingTnd((data.shipping/1000).toFixed(3));}
  }).catch(error=>{if(!ctrl.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');});
  return()=>ctrl.abort();
 },[url]);
 function set<K extends keyof Branding>(key:K,value:Branding[K]){
  setBrand(old=>old?{...old,[key]:value}:old);pending.current=null;
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!brand)return;
  const shipping=Math.round(Number(shippingTnd)*1000);
  if(!Number.isSafeInteger(shipping)||shipping<0||shipping>1000000000){setNotice('Frais de livraison invalides');return;}
  const payload={...brand,shipping};
  const key=JSON.stringify(payload);
  const requestId=pending.current?.key===key?pending.current.requestId:crypto.randomUUID();
  pending.current={key,requestId};setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'settings',requestId,payload})});
   const data=await response.json() as Branding&{error?:string;alreadyApplied?:boolean};
   if(!response.ok)throw Error(data.error||'Enregistrement refusé');
   setBrand(data);pending.current=null;
   setNotice('Identité commerciale enregistrée pour cette boutique. Actualisez l’aperçu public pour voir les changements.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau, réessayez les mêmes données.');}
  finally{setBusy(false);}
 }
 return <div style={{marginTop:18,border:'1px solid #dbe6eb',borderRadius:14,padding:18,background:'#fff'}}>
  <h3>Identité et présentation de ma boutique</h3>
  <p>Ces informations sont publiées avec votre catalogue, lorsque vous activez la vitrine. Les images doivent être hébergées en HTTPS (pas de chargement de fichier local ni de domaine personnalisé ici).</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {brand?<form onSubmit={event=>void save(event)} style={{display:'grid',gap:12,maxWidth:650}}>
   <label>Nom de vitrine<input required minLength={2} maxLength={160} value={brand.name} onChange={e=>set('name',e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>
   <label>Description / slogan<textarea maxLength={1000} rows={3} value={brand.description} onChange={e=>set('description',e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>
   <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
    <label>Téléphone de contact<input maxLength={30} value={brand.phone} onChange={e=>set('phone',e.target.value)} style={{display:'block',padding:9}}/></label>
    <label>Adresse commerciale<input maxLength={200} value={brand.address} onChange={e=>set('address',e.target.value)} style={{display:'block',padding:9}}/></label>
    <label>Livraison par défaut (TND)<input required type="number" min="0" max="1000000" step="0.001" value={shippingTnd} onChange={e=>{setShippingTnd(e.target.value);pending.current=null;}} style={{display:'block',padding:9,width:150}}/></label>
   </div>
   <label>Logo HTTPS<input type="url" maxLength={2000} placeholder="https://..." value={brand.logoUrl} onChange={e=>set('logoUrl',e.target.value)} style={{display:'block',padding:9,width:'100%'}}/></label>
   <label>Bannière HTTPS<input type="url" maxLength={2000} placeholder="https://..." value={brand.bannerUrl} onChange={e=>set('bannerUrl',e.target.value)} style={{display:'block',padding:9,width:'100%'}}/></label>
   <small>Les zones de livraison configurées remplacent les frais par défaut pour leurs gouvernorats. Les URLs peuvent exposer des métadonnées de consultation à l’hébergeur de vos images.</small>
   <button type="submit" disabled={busy} style={{background:'#126c65',color:'white',padding:'12px 18px',border:0,borderRadius:10,width:'fit-content'}}>Enregistrer la présentation</button>
  </form>:<p>Chargement des paramètres…</p>}
 </div>;
}
