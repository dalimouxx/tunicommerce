'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {AuthPortal} from '../modules/auth/portal';

export default function AccountRecovery({mode,ready=true,portal:initialPortal='MERCHANT'}:{
 mode:'request'|'reset'|'verify';ready?:boolean;portal?:AuthPortal
}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
 const [token,setToken]=useState(''),[portal,setPortal]=useState(initialPortal);
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 const initialized=useRef(false);
 useEffect(()=>{
  if(mode==='request'||initialized.current)return;initialized.current=true;
  const params=new URLSearchParams(window.location.hash.slice(1));
  const value=params.get('jeton')||'';
  if(/^[a-f0-9]{64}$/.test(value))setToken(value);
  if(params.get('portail')==='ADMIN')setPortal('ADMIN');
  window.history.replaceState(null,'',window.location.pathname);
 },[mode]);
 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return;
  if(mode==='reset'&&password!==confirmation){setError('Les mots de passe ne correspondent pas.');return;}
  setBusy(true);setError('');
  try{
   const endpoint=mode==='request'?'request':mode==='reset'?'reset':'verify';
   const response=await fetch('/api/auth/account/'+endpoint,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(mode==='request'?{email,portal}:mode==='reset'?{token,password}:{token})});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error||'Opération indisponible');
   setDone(true);setToken('');setPassword('');setConfirmation('');
  }catch(error){setError(error instanceof Error?error.message:'Service indisponible');}
  finally{setBusy(false);}
 }
 const login=portal==='ADMIN'?'/connexion/admin':'/connexion/boutique';
 return <main className="auth-panel" style={{minHeight:'100vh'}}><section className="auth-card">
  <p className="auth-eyebrow">TUNICOMMERCE · SÉCURITÉ DU COMPTE</p>
  <h1>{mode==='request'?'Mot de passe oublié':mode==='reset'?'Choisir un nouveau mot de passe':'Vérifier mon adresse e-mail'}</h1>
  {done?<div role="status">
   <p>{mode==='request'?'Si un compte correspond à cette adresse et à cet espace, une demande de récupération a été enregistrée. Consultez aussi vos courriers indésirables.':
    mode==='reset'?'Votre mot de passe a été modifié. Toutes les sessions précédentes ont été déconnectées.':'Votre adresse e-mail a été vérifiée.'}</p>
   <a href={login}>Revenir à la connexion</a>
  </div>:<>
   <p>{mode==='request'?'Indiquez l’adresse de votre compte pour demander un lien personnel de récupération.':
    mode==='reset'?'Utilisez un mot de passe d’au moins 12 caractères. Le lien ne peut être utilisé qu’une seule fois.':'Confirmez l’adresse du compte qui a demandé ce lien.'}</p>
   {!ready&&<p role="status">L’envoi des e-mails de sécurité n’est pas encore configuré. Contactez l’administration pour récupérer votre accès.</p>}
   {mode!=='request'&&!token&&<p role="status">Ouvrez le lien complet reçu par e-mail. Après une actualisation de cette page, ouvrez de nouveau ce lien.</p>}
   <form onSubmit={event=>void submit(event)}>
    {mode==='request'&&<label>Adresse e-mail<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)}/></label>}
    {mode==='reset'&&<>
     <label>Nouveau mot de passe<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)}/></label>
     <label>Confirmer le mot de passe<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>
    </>}
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <button className="primary" type="submit" disabled={busy||!ready||(mode!=='request'&&!token)}>
     {busy?'Traitement…':mode==='request'?'Demander le lien':mode==='reset'?'Enregistrer le mot de passe':'Confirmer mon adresse'}
    </button>
   </form>
   <p><a href={login}>Retour à la connexion</a></p>
  </>}
 </section></main>;
}
