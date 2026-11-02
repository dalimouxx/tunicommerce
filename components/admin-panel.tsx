'use client';
import {useMemo,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {Plus,Search,Store,ArrowUpRight,ShieldCheck,Link2,Settings2,AlertTriangle,CheckCircle2} from 'lucide-react';
import styles from '../app/admin/platform.module.css';

export type ManagedShop={
 id:string;name:string;owner:string;email:string;ownerRole:string;
 slug:string;published:boolean;plan:string;subscriptionStatus:string;
 subscriptionEndsAt:string;hasLinkedShop:boolean;
};

function Settings({shop}:{shop?:ManagedShop}){
 return <div className={styles.configGrid}>
  <label>Lien public de la boutique
   <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={60}
    placeholder="ma-boutique" defaultValue={shop?.slug}/>
  </label>
  <label>Formule (classification manuelle)
   <select name="plan" defaultValue={shop?.plan||'STARTER'}>
    {['STARTER','PRO','BUSINESS'].map(plan=><option key={plan} value={plan}>{plan}</option>)}
   </select>
  </label>
  <label>Statut de l’abonnement
   <select name="subscriptionStatus" defaultValue={shop?.subscriptionStatus||'TRIAL'}>
    <option value="TRIAL">Essai</option><option value="ACTIVE">Actif</option>
    <option value="SUSPENDED">Suspendu</option><option value="CANCELLED">Résilié</option>
   </select>
  </label>
  <label>Valable jusqu’au (date tunisienne)
   <input name="subscriptionEndsAt" type="date" required
    defaultValue={shop?.subscriptionEndsAt.slice(0,10)||new Date(Date.now()+30*86400000).toISOString().slice(0,10)}/>
  </label>
  <label className={styles.formCheck}>
   <input name="published" type="checkbox" defaultChecked={shop?.published}/>
   Publication demandée
  </label>
 </div>;
}

export default function AdminPanel({
 shops,initialShopId='',initialFilter='all'
}:{shops:ManagedShop[],initialShopId?:string,initialFilter?:string}){
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState(initialFilter==='unlinked'?'unlinked':'all');
 const [selected,setSelected]=useState(initialShopId);
 const [create,setCreate]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [linking,setLinking]=useState(false);
 const current=shops.find(shop=>shop.id===selected);
 const visible=useMemo(()=>shops.filter(shop=>{
  if(!(shop.name+' '+shop.owner+' '+shop.email+' '+shop.slug).toLowerCase().includes(query.toLowerCase().trim()))return false;
  if(filter==='unlinked')return !shop.hasLinkedShop;
  if(filter==='published')return shop.published;
  if(filter==='draft')return !shop.published;
  return true;
 }),[shops,query,filter]);

 async function submit(event:FormEvent<HTMLFormElement>,id?:string){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setMessage('');setError('');
  const values=Object.fromEntries(new FormData(event.currentTarget));
  try{
   const response=await fetch('/api/admin/shops',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     ...values,action:id?'update':'create',id,published:values.published==='on',
     subscriptionEndsAt:String(values.subscriptionEndsAt)+'T23:59:59.999Z'
    })
   });
   const result=await response.json() as {error?:string,workspaceId?:string};
   if(!response.ok)throw new Error(result.error||'Enregistrement impossible');
   if(!id&&result.workspaceId){
    window.location.assign('/admin/boutiques/'+result.workspaceId);
   }else{
    window.location.assign('/admin/gestion-boutiques?shop='+id);
   }
  }catch(e){setError(e instanceof Error?e.message:'Erreur d’enregistrement');}
  finally{setBusy(false);}
 }

 async function linkLegacy(){
  if(!current||linking||busy)return;
  if(!window.confirm('Relier cette boutique à une organisation et créer le rôle propriétaire ? Ses produits et commandes seront conservés.'))return;
  setLinking(true);setMessage('');setError('');
  try{
   const response=await fetch('/api/admin/shops',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'link',id:current.id})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Liaison impossible');
   window.location.assign('/admin/gestion-boutiques?shop='+current.id);
  }catch(e){setError(e instanceof Error?e.message:'Liaison impossible');setLinking(false);}
 }

 return <>
  <div className={styles.head}>
   <div><span className={styles.eyebrow}>GESTION CENTRALE · SUPER-ADMIN</span>
    <h1>Configurer les boutiques</h1>
    <p>Créer un marchand, modifier une offre, gérer la publication ou relier une boutique historique à sa structure d’équipe.</p>
   </div>
   <button type="button" className={styles.primary} onClick={()=>{setCreate(v=>!v);setError('');setMessage('');}}>
    <Plus size={17}/>{create?'Masquer le formulaire':'Créer une boutique et son marchand'}
   </button>
  </div>
  <div className={styles.metricsInline}>
   <ShieldCheck size={18}/>
   <span><strong>Gestion manuelle :</strong> changer une offre n’encaisse aucun paiement. Une boutique n’est visible aux acheteurs que si elle est publiée et son abonnement valide.</span>
  </div>
  {error&&<div className={styles.inlineError} role="alert"><AlertTriangle size={17}/>{error}</div>}
  {message&&<div className={styles.inlineSuccess} role="status"><CheckCircle2 size={17}/>{message}</div>}
  {create&&<section className={styles.panel+' '+styles.editorPanel}>
   <div className={styles.panelHead}><div><h2>Créer un marchand et sa boutique</h2><p>Cette action crée également son organisation, son accès propriétaire et sa structure d’équipe.</p></div></div>
   <form className={styles.configForm} onSubmit={e=>void submit(e)}>
    <div className={styles.configGrid}>
     <label>Nom du marchand<input name="name" minLength={2} maxLength={100} required/></label>
     <label>E-mail du marchand<input name="email" type="email" autoComplete="off" required/></label>
     <label>Mot de passe initial<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
     <label>Nom de la boutique<input name="shopName" minLength={2} maxLength={100} required/></label>
    </div>
    <Settings/>
    <div className={styles.inlineWarning}>Privilégiez une boutique non publiée jusqu’à l’ajout des coordonnées et d’au moins un produit. Le mot de passe initial doit être transmis au marchand par un canal privé.</div>
    <button className={styles.primary} type="submit" disabled={busy}>{busy?'Création…':'Créer le compte et la boutique'}</button>
   </form>
  </section>}
  <div className={styles.detailGrid}>
   <section className={styles.panel}>
    <div className={styles.panelHead}><div><h2>Toutes les boutiques</h2><p>Sélectionnez une boutique pour modifier ses paramètres.</p></div></div>
    <div className={styles.filters}>
     <label className={styles.searchBox}><Search size={16}/><input placeholder="Boutique, marchand, e-mail" aria-label="Rechercher une boutique à gérer" value={query} onChange={e=>setQuery(e.target.value)}/></label>
     <select className={styles.simpleSelect} aria-label="Filtrer les boutiques à gérer" value={filter} onChange={e=>setFilter(e.target.value)}>
      <option value="all">Toutes</option>
      <option value="unlinked">Structure non reliée</option>
      <option value="published">Publication demandée</option>
      <option value="draft">Non publiées</option>
     </select>
    </div>
    <div className={styles.manageList}>
     {visible.map(shop=><button type="button" key={shop.id}
      className={styles.manageItem+(selected===shop.id?' '+styles.manageSelected:'')}
      onClick={()=>{setSelected(shop.id);setError('');setCreate(false);}}>
      <span className={styles.manageIcon}><Store size={17}/></span>
      <span><strong>{shop.name}</strong><small>{shop.owner} · {shop.plan}</small></span>
      <span className={shop.hasLinkedShop?styles.success:styles.waiting}>{shop.hasLinkedShop?'Reliée':'À relier'}</span>
     </button>)}
     {!visible.length&&<p className={styles.mutedEmpty}>Aucune boutique ne correspond à ces critères.</p>}
    </div>
   </section>
   <section className={styles.panel}>
    {current?<div>
     <div className={styles.panelHead}><div><h2><Settings2 size={19}/> {current.name}</h2>
      <p>{current.owner} · {current.email}</p></div>
      <Link href={'/admin/boutiques/'+current.id} className={styles.action}>Fiche complète <ArrowUpRight size={15}/></Link>
     </div>
     <form key={current.id} className={styles.configForm} onSubmit={e=>void submit(e,current.id)}>
      <Settings shop={current}/>
      <button type="submit" className={styles.primary} disabled={busy}>{busy?'Enregistrement…':'Enregistrer les paramètres'}</button>
     </form>
     <div className={styles.editExtra}>
      {current.slug&&<Link href={'/boutiques/'+current.slug} className={styles.action} target="_blank">Ouvrir la boutique publique <ArrowUpRight size={14}/></Link>}
      {!current.hasLinkedShop&&<div className={styles.inlineWarning}>
       <p>Cette boutique utilise l'ancien modèle : l'organisation et les membres ne sont pas encore reliés.</p>
       <button type="button" disabled={linking||busy} className={styles.secondary} onClick={()=>void linkLegacy()}>
        <Link2 size={15}/>{linking?'Liaison…':'Relier l’organisation et le propriétaire'}
       </button>
      </div>}
     </div>
    </div>:<div className={styles.empty}><Store size={31}/><strong>Choisissez une boutique</strong><p>Ses paramètres apparaîtront ici sans mélanger les données des autres marchands.</p></div>}
   </section>
  </div>
 </>;
}
