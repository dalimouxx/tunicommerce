'use client';
import {useState} from 'react';
export default function PortalLogout(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function logout(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/auth/admin/logout',{
    method:'POST',headers:{'Content-Type':'application/json'}
   });
   if(!response.ok)throw Error('Déconnexion indisponible');
   window.location.assign('/connexion/admin');
  }catch(err){setError(err instanceof Error?err.message:'Erreur réseau');setBusy(false);}
 }
 return <span style={{display:'block',marginTop:8}}>
  <button type="button" onClick={()=>void logout()} disabled={busy}
   style={{padding:'7px 10px',borderRadius:8,border:'1px solid #b7cbd2',background:'#fff',color:'#164954',cursor:'pointer'}}>
   {busy?'Déconnexion…':'Déconnexion Super Admin'}
  </button>
  {error&&<small role="alert">{error}</small>}
 </span>;
}
