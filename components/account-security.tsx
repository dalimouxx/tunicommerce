'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {AuthPortal} from '../modules/auth/portal';

export default function AccountSecurity({email,verified,mfaEnabled,emailReady,mfaReady,portal}:{
 email:string;verified:boolean;mfaEnabled:boolean;emailReady:boolean;mfaReady:boolean;portal:AuthPortal
}){
 const router=useRouter();
 const [password,setPassword]=useState(''),[otp,setOtp]=useState(''),[secret,setSecret]=useState('');
 const [recovery,setRecovery]=useState<string[]>([]),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function verify(){
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/auth/account/verify',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({portal})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Demande indisponible');
   setMessage('La demande de vérification a été enregistrée. Consultez votre messagerie.');
  }catch(error){setError(error instanceof Error?error.message:'Demande indisponible');}
  finally{setBusy(false);}
 }
 async function mfa(action:'begin'|'confirm'|'disable'|'recovery'){
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/auth/account/mfa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,portal,password,otp})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Opération indisponible');
   if(action==='begin'){setSecret(data.secret);setRecovery([]);setOtp('');}
   else{
    setSecret('');setPassword('');setOtp('');setRecovery(data.recoveryCodes||[]);
    setMessage(action==='disable'?'Double authentification désactivée. Les autres sessions ont été déconnectées.':
     'Enregistrez les codes de secours ci-dessous. Ils ne seront affichés qu’une fois. Les autres sessions ont été déconnectées.');
    router.refresh();
   }
  }catch(error){setError(error instanceof Error?error.message:'Opération indisponible');}
  finally{setBusy(false);}
 }
 return <div style={{display:'grid',gap:24}}>
  <section className="card" style={{padding:24}}><h2>Adresse e-mail</h2><p>{email} · {verified?'Vérifiée':'À vérifier'}</p>
   {!verified&&<button type="button" className="primary" disabled={busy||!emailReady} onClick={()=>void verify()}>Demander un lien de vérification</button>}
   {!emailReady&&<p>L’envoi d’e-mails attend la configuration du service par l’administration.</p>}
  </section>
  <section className="card" style={{padding:24}}><h2>Double authentification</h2>
   <p>{mfaEnabled?'Activée : la connexion nécessite un code d’application ou un code de secours.':'Ajoutez un code d’application à votre mot de passe.'}</p>
   {!mfaReady?<p>La double authentification attend la configuration du chiffrement par l’administration.</p>:<div style={{display:'grid',gap:12,maxWidth:520}}>
    <label>Mot de passe actuel<input type="password" autoComplete="current-password" maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} style={{display:'block',padding:10,width:'100%'}}/></label>
    {(!mfaEnabled&&!secret)?<button type="button" className="primary" disabled={busy||!password} onClick={()=>void mfa('begin')}>Préparer la double authentification</button>:<>
     {secret&&<div><p>Dans votre application d’authentification, ajoutez un compte TOTP : Tunicom, {email}. Saisissez cette clé manuellement :</p>
      <code style={{display:'block',overflowWrap:'anywhere',padding:12}}>{secret}</code><p>Code à 6 chiffres, renouvelé toutes les 30 secondes.</p></div>}
     <label>{secret?'Code à 6 chiffres de l’application':'Code d’application ou code de secours'}<input autoComplete="one-time-code" maxLength={32} value={otp} onChange={event=>setOtp(event.target.value)} style={{display:'block',padding:10,width:'100%'}}/></label>
     {secret?<button type="button" className="primary" disabled={busy||!password||!otp} onClick={()=>void mfa('confirm')}>Confirmer l’activation</button>:<>
      <button type="button" disabled={busy||!password||!otp} onClick={()=>void mfa('recovery')}>Renouveler mes codes de secours</button>
      <button type="button" disabled={busy||!password||!otp} onClick={()=>void mfa('disable')}>Désactiver la double authentification</button>
     </>}
    </>}
   </div>}
   {recovery.length>0&&<div><h3>Codes de secours personnels</h3><p>Conservez-les hors de votre compte. Chaque code ne fonctionne qu’une fois. Un renouvellement invalide les anciens codes.</p>
    <ul>{recovery.map(code=><li key={code}><code>{code}</code></li>)}</ul>
    <button type="button" onClick={()=>setRecovery([])}>J’ai enregistré mes codes, les masquer</button>
   </div>}
  </section>
  {error&&<p role="alert" className="auth-error">{error}</p>}
  {message&&<p role="status">{message}</p>}
 </div>;
}
