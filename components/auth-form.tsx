'use client';
import {useState} from 'react';
import {ShoppingBag,ArrowRight,LockKeyhole,ShieldCheck,Store} from 'lucide-react';
import type {AuthPortal} from '../modules/auth/portal';
export function AuthForm({setup=false,portal='MERCHANT'}:{setup?:boolean;portal?:AuthPortal}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [done,setDone]=useState(false);
 const [requiresMfa,setRequiresMfa]=useState(false);
 const admin=setup||portal==='ADMIN';
 const loginPath=admin?'/api/auth/admin/login':'/api/auth/merchant/login';
 const landing=admin?'/admin':'/mes-boutiques';
 return <div className="auth-shell">
  <section className="auth-story">
   <a href="/decouvrir" className="auth-brand"><b className="auth-monogram" aria-hidden="true">t.</b>Tunicom<span>TN</span></a>
   <div>
    <p className="auth-eyebrow">{admin?'SUPER ADMIN · ACCÈS GLOBAL':'MA BOUTIQUE · ESPACE PRIVÉ'}</p>
    <h1>{admin?<>Pilotez la plateforme.<br/>En toute sécurité.</>:<>Votre boutique.<br/>Votre croissance.</>}</h1>
    <p>{admin?'Gérez les marchands, abonnements, offres et contrôles du SaaS. La gestion d’une boutique utilise une autre connexion.':'Gérez vos produits, commandes, clients, paiements COD et livraisons dans votre espace marchand.'}</p>
    <div className="auth-chips">{admin?<><span>Supervision</span><span>Abonnements</span><span>Sécurité</span></>:<><span>Catalogue</span><span>Commandes</span><span>Livraisons</span></>}</div>
   </div>
   <small>Tunicom · Connexions indépendantes</small>
  </section>
  <section className="auth-panel"><div className="auth-card">
   <div className="auth-lock">{admin?<ShieldCheck size={22}/>:<Store size={22}/>}</div>
   <p className="auth-eyebrow">{admin?'ADMINISTRATION GLOBALE':'ADMINISTRATION BOUTIQUE'}</p>
   <h2>{setup?'Créer le Super Admin':admin?'Connexion Super Admin':'Connexion marchand'}</h2>
   <p>{setup?'Initialisation unique de la plateforme.':admin?'Compte Super Admin uniquement. Votre session ne permet pas d’ouvrir directement une boutique.':'Accès réservé à vos boutiques personnelles et aux équipes autorisées.'}</p>
   {done?<div role="status"><p>Compte Super Admin créé. Identifiez-vous sur son portail réservé.</p>
    <a className="primary" href="/connexion/admin">Connexion Super Admin <ArrowRight size={16}/></a></div>:
    <form onSubmit={async event=>{
     event.preventDefault();if(busy)return;
     setBusy(true);setError('');
     const values=Object.fromEntries(new FormData(event.currentTarget));
     try{
      const response=await fetch(setup?'/api/auth/setup':loginPath,{
       method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)
      });
      const data=await response.json() as {error?:string;requiresMfa?:boolean};
      if(data.requiresMfa)setRequiresMfa(true);
      if(!response.ok)throw Error(data.error||'Connexion refusée');
      if(setup)setDone(true);
      else window.location.assign(landing);
     }catch(err){setError(err instanceof Error?err.message:'Connexion impossible');}
     finally{setBusy(false);}
    }}>
     {setup&&<label>Nom du propriétaire<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>}
     <label>Adresse e-mail<input name="email" type="email" autoComplete="username" required maxLength={254} placeholder={admin?'admin@tunicommerce.tn':'vous@boutique.tn'}/></label>
     <label>Mot de passe<input name="password" type="password" autoComplete={setup?'new-password':'current-password'} required minLength={setup?12:1} maxLength={128}/></label>
     {requiresMfa&&!setup&&<label>Code de l’application ou code de secours<input name="otp" autoComplete="one-time-code" required maxLength={32}/></label>}
     {setup&&<><label>Clé d’initialisation<input name="token" type="password" autoComplete="off" required minLength={32} maxLength={256}/></label>
      <small>Clé SETUP_TOKEN du serveur Render ; mot de passe de 12 caractères minimum.</small></>}
     {error&&<p className="auth-error" role="alert">{error}</p>}
     <button className="primary" type="submit" disabled={busy}>{busy?'Connexion…':setup?'Créer le Super Admin':'Accéder à mon espace'}<ArrowRight size={16}/></button>
    </form>}
   <div className="auth-foot">
    {!setup&&<p><a href={'/compte/recuperer?portail='+portal}>Mot de passe oublié ?</a></p>}
    {!setup&&<p><a href="/decouvrir">Retour à Tunicom</a></p>}
    {admin&&<p><a href="/connexion/boutique">Connexion à ma boutique</a></p>}
    {!admin&&<p><a href="/inscription">Créer ma boutique gratuitement</a></p>}
    <p><a href="/boutiques">Voir les boutiques publiques</a></p>
   </div>
  </div></section>
 </div>;
}
