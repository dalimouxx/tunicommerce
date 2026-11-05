'use client';
import {useState} from 'react';
import ShopBranding from './shop-branding';
import ShopMarketing from './shop-marketing';

export default function ShopPublication({shopId,slug,initialPublished}:{shopId:string;slug:string;initialPublished:boolean}){
 const [published,setPublished]=useState(initialPublished);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const publicPath='/vitrines/'+encodeURIComponent(slug);
 async function toggle(){
  setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/publication',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({published:!published})
   });
   const data=await response.json() as {published?:boolean;error?:string};
   if(!response.ok)throw new Error(data.error||'Modification impossible');
   setPublished(data.published===true);
   setNotice(data.published?'Vitrine publiée. Les commandes COD sont possibles sous réserve de disponibilité et d’un abonnement actif.':'Catalogue retiré de la vitrine publique.');
  }catch(error){setNotice(error instanceof Error?error.message:'Une erreur est survenue');}
  finally{setBusy(false);}
 }
 return <><div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
  <button type="button" disabled={busy} onClick={()=>void toggle()}
   style={{padding:'12px 18px',border:0,borderRadius:10,background:published?'#984b39':'#126c65',color:'#fff',fontWeight:700}}>
   {published?'Retirer du public':'Publier mon catalogue'}
  </button>
  {published&&<a href={publicPath} target="_blank" rel="noopener noreferrer">Voir la vitrine publique</a>}
  <span aria-live="polite" role="status">{notice}</span>
 </div><ShopBranding shopId={shopId}/><ShopMarketing shopId={shopId}/></>;
}
