'use client';

import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowRight,ShoppingBag,Store,CheckCircle2,ShieldCheck} from 'lucide-react';
import styles from './signup.module.css';

function slugify(value:string){
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60).replace(/-$/,'');
}

export default function SignupForm(){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [shopName,setShopName]=useState('');
 const [slug,setSlug]=useState('');
 const [customSlug,setCustomSlug]=useState(false);

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setError('');
  try{
   const res=await fetch('/api/auth/register',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({name,email,password,shopName,slug})
   });
   const data=await res.json() as {error?:string,next?:string};
   if(!res.ok)throw new Error(data.error||'Impossible de créer votre boutique');
   window.location.assign(data.next||'/demarrage');
  }catch(e){setError(e instanceof Error?e.message:'Erreur de connexion');setBusy(false);}
 }

 return <div className={styles.shell}>
  <aside className={styles.story}>
   <Link href="/boutiques" className={styles.brand}><span><ShoppingBag size={21}/></span>Tunicom</Link>
   <div className={styles.storyMain}>
    <div className={styles.tag}>PLATEFORME E-COMMERCE TUNISIENNE</div>
    <h1>Votre boutique.<br/><em>Votre croissance.</em></h1>
    <p>Lancez votre boutique en ligne, recevez vos commandes et gérez la livraison et les encaissements COD dans un seul espace.</p>
    <div className={styles.benefits}>
     <div><CheckCircle2 size={19}/> Boutique publique avec panier et paiement à la livraison</div>
     <div><CheckCircle2 size={19}/> Commandes, produits, clients et stocks</div>
     <div><CheckCircle2 size={19}/> Équipe, permissions et suivi des ventes</div>
    </div>
   </div>
   <div className={styles.storyFooter}>🇹🇳 Pensé pour les commerçants en Tunisie · TND</div>
  </aside>
  <main className={styles.main}>
   <div className={styles.card}>
    <div className={styles.icon}><Store size={24}/></div>
    <p className={styles.eyebrow}>COMMENCER AVEC TUNICOM</p>
    <h2>Créez votre boutique</h2>
    <p className={styles.description}>Configurez votre espace marchand et préparez votre première vente. Aucun paiement n’est demandé à l’inscription.</p>
    <form onSubmit={submit} className={styles.form}>
     <label>Votre nom complet<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={100} placeholder="Nom et prénom"/></label>
     <label>Adresse e-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} placeholder="vous@exemple.tn"/></label>
     <label>Mot de passe<input required type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} maxLength={128} placeholder="12 caractères minimum"/></label>
     <label>Nom de votre boutique<input required value={shopName} onChange={e=>{setShopName(e.target.value);if(!customSlug)setSlug(slugify(e.target.value));}} minLength={2} maxLength={100} placeholder="Ex. Ma Boutique Mode"/></label>
     <label>Lien de votre boutique<input required value={slug} onChange={e=>{setCustomSlug(true);setSlug(e.target.value);}} pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={60} placeholder="ma-boutique-mode"/>
      <small>tunicommerce-test.onrender.com/boutiques/{slug||'ma-boutique'}</small></label>
     {error&&<p className={styles.error} role="alert">{error}</p>}
     <button className={styles.submit} type="submit" disabled={busy||slug.length<3}>{busy?'Création…':'Créer ma boutique'} <ArrowRight size={18}/></button>
     <p className={styles.security}><ShieldCheck size={14}/> Espace privé par marchand · Essai initial de 30 jours · Configuration avant publication</p>
    </form>
    <div className={styles.foot}>Vous avez déjà un compte ? <Link href="/connexion/boutique">Se connecter</Link></div>
   </div>
  </main>
 </div>;
}
