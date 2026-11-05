'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';

type Marketing={metaPixelId:string;tiktokPixelId:string;whatsapp:string;whatsappMessage:string;language:'fr'|'ar'};
const field={display:'block',width:'100%',padding:10,marginTop:4,border:'1px solid #cfdde3',borderRadius:9} as const;

export default function ShopMarketing({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/marketing';
 const [values,setValues]=useState<Marketing|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(false);
 const pending=useRef<{key:string;requestId:string}|null>(null);
 useEffect(()=>{
  const ctrl=new AbortController();
  fetch(url,{cache:'no-store',signal:ctrl.signal}).then(async response=>{
   const data=await response.json() as Marketing&{error?:string};
   if(!response.ok)throw Error(data.error||'Réglages indisponibles');
   if(!ctrl.signal.aborted)setValues(data);
  }).catch(e=>{if(!ctrl.signal.aborted){setError(true);setNotice(e instanceof Error?e.message:'Erreur réseau');}});
  return()=>ctrl.abort();
 },[url]);
 function set(key:keyof Marketing,value:string){setValues(old=>old?{...old,[key]:value}:old);pending.current=null;}
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!values)return;
  const payload={metaPixelId:values.metaPixelId.trim(),tiktokPixelId:values.tiktokPixelId.trim(),
   whatsapp:values.whatsapp.trim(),whatsappMessage:values.whatsappMessage.trim(),language:values.language};
  const key=JSON.stringify(payload);
  const requestId=pending.current?.key===key?pending.current.requestId:crypto.randomUUID();
  pending.current={key,requestId};setBusy(true);setNotice('');setError(false);
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'marketing',requestId,payload})});
   const data=await response.json() as Marketing&{error?:string};
   if(!response.ok)throw Error(data.error||'Enregistrement refusé');
   setValues(data);pending.current=null;
   setNotice('Réglages enregistrés. Ils sont actifs immédiatement sur votre vitrine publiée.');
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:'Erreur réseau, réessayez.');}
  finally{setBusy(false);}
 }
 return <div style={{marginTop:18,border:'1px solid #dbe6eb',borderRadius:14,padding:18,background:'#fff'}}>
  <h3 style={{marginTop:0}}>Langue, publicité et WhatsApp</h3>
  <p style={{color:'#53667c',marginTop:4}}>Mesurez les ventes de vos publicités Facebook, Instagram et TikTok, et laissez vos clients vous écrire sur WhatsApp. Laissez un champ vide pour le désactiver.</p>
  {notice&&<p role="status" aria-live="polite" style={{padding:10,borderRadius:9,background:error?'#fdecea':'#e8f5ef',color:error?'#8e1c1c':'#145c3c'}}>{notice}</p>}
  {values?<form onSubmit={e=>void save(e)} style={{display:'grid',gap:14,maxWidth:650}}>
   <label>Langue de la vitrine
    <select value={values.language} onChange={e=>set('language',e.target.value)} style={field}>
     <option value="fr">Français</option>
     <option value="ar">العربية (arabe, de droite à gauche)</option>
    </select>
    <small style={{color:'#6b7c88'}}>Langue affichée par défaut. Vos clients peuvent toujours changer avec le bouton FR / العربية. Pour une publicité en arabe, utilisez le lien de votre vitrine suivi de <code>?lang=ar</code>.</small>
   </label>
   <label>Pixel Meta (Facebook / Instagram)
    <input inputMode="numeric" maxLength={20} placeholder="Ex. 123456789012345" value={values.metaPixelId}
     onChange={e=>set('metaPixelId',e.target.value.replace(/\D/g,''))} style={field}/>
    <small style={{color:'#6b7c88'}}>Gestionnaire d’événements Meta → Sources de données → identifiant du pixel (chiffres uniquement).</small>
   </label>
   <label>Pixel TikTok
    <input maxLength={30} placeholder="Ex. C9ABCDEF1234567890AB" value={values.tiktokPixelId}
     onChange={e=>set('tiktokPixelId',e.target.value.replace(/[^A-Za-z0-9]/g,'').toUpperCase())} style={field}/>
    <small style={{color:'#6b7c88'}}>TikTok Ads Manager → Outils → Événements → identifiant du pixel web.</small>
   </label>
   <label>Numéro WhatsApp
    <input type="tel" inputMode="tel" maxLength={20} placeholder="22 123 456" value={values.whatsapp}
     onChange={e=>set('whatsapp',e.target.value)} style={field}/>
    <small style={{color:'#6b7c88'}}>Affiche un bouton WhatsApp sur la vitrine et après chaque commande.</small>
   </label>
   <label>Message pré-rempli (facultatif)
    <input maxLength={300} placeholder="Bonjour, je suis intéressé(e) par" value={values.whatsappMessage}
     onChange={e=>set('whatsappMessage',e.target.value)} style={field}/>
   </label>
   <small style={{color:'#6b7c88'}}>Événements envoyés : PageView, ViewContent (page produit), InitiateCheckout (envoi du formulaire) et Purchase (commande acceptée, montant en TND). Aucune donnée personnelle du client n’est transmise aux pixels.</small>
   <button type="submit" disabled={busy} style={{background:'#126c65',color:'white',padding:'12px 18px',border:0,borderRadius:10,width:'fit-content',fontWeight:700}}>
    {busy?'Enregistrement…':'Enregistrer'}</button>
  </form>:!error&&<p>Chargement…</p>}
 </div>;
}
