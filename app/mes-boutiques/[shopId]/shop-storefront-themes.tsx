'use client';
import {useEffect,useState} from 'react';
import {storefrontThemeCodes,storefrontPalette,type StorefrontThemeCode} from '../../../modules/shops/storefront-themes';
export default function ShopStorefrontThemes({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/storefront-theme';
 const [active,setActive]=useState<StorefrontThemeCode>('OASIS');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error('Thèmes indisponibles');
   const result=await response.json() as {theme?:{code:StorefrontThemeCode}};
   if(!controller.signal.aborted&&result.theme)setActive(result.theme.code);
  }).catch(e=>{if(!controller.signal.aborted)setNotice(e instanceof Error?e.message:'Erreur');});
  return()=>controller.abort();
 },[url]);
 async function save(theme:StorefrontThemeCode){
  if(theme===active)return;
  setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    action:'saveStorefrontTheme',payload:{theme},requestId:crypto.randomUUID()
   })});
   const data=await response.json() as {theme?:{code:StorefrontThemeCode};error?:string};
   if(!response.ok)throw Error(data.error||'Enregistrement impossible');
   setActive(data.theme?.code||theme);
   setNotice('Thème enregistré. Il s’applique à la vitrine publique lorsque la boutique est publiée.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau');}
  finally{setBusy(false);}
 }
 return <section style={{background:'#fff',padding:24,borderRadius:16,border:'1px solid #dce6ec',marginTop:16}}>
  <h2>Thèmes de ma boutique publique</h2>
  <p>Choisissez une ambiance prête à l'emploi. Les couleurs sont vérifiées côté serveur ; aucune feuille de style externe n'est exécutée.</p>
  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
   {storefrontThemeCodes.map(code=>{
    const theme=storefrontPalette(code);
    return <div key={code} style={{flex:'1 1 180px',padding:16,border:'1px solid #dce6ec',borderRadius:12,background:theme.background,color:theme.foreground}}>
     <strong>{theme.name}</strong>
     <p style={{color:theme.muted}}>Aperçu des couleurs de la vitrine</p>
     <button type="button" disabled={busy||active===code} onClick={()=>void save(code)}
      style={{padding:10,background:theme.accent,color:code==='MINUIT'?'#112331':'white',border:0,borderRadius:8}}>
      {active===code?'Thème actif':'Choisir ce thème'}
     </button>
    </div>;
   })}
  </div>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
 </section>;
}
