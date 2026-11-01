'use client';

import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowRight,CheckCircle2,Store,PackagePlus,Globe,ExternalLink,ShieldCheck,Save,RefreshCw} from 'lucide-react';
import styles from './setup.module.css';

type SetupData={
 shop:{name:string,phone:string,address:string,description:string,shipping:number};
 slug:string|null;published:boolean;publicationRequested:boolean;
 subscriptionStatus:string;subscriptionEndsAt:string|null;plan:string;
 productCount:number;availableCount:number;ready:boolean;missing:string[];
 linkedShopId:string|null;
};
type Notice={message:string,error:boolean};

async function api<T>(url:string,method='GET',body?:unknown):Promise<T>{
 const r=await fetch(url,{
  method,credentials:'same-origin',cache:'no-store',
  ...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})
 });
 const d=await r.json().catch(()=>({})) as {error?:string};
 if(!r.ok)throw new Error(d.error||'Erreur de communication');
 return d as T;
}

export default function SetupWizard(){
 const [data,setData]=useState<SetupData|null>(null);
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [address,setAddress]=useState('');
 const [description,setDescription]=useState('');
 const [shipping,setShipping]=useState('8');
 const [slug,setSlug]=useState('');
 const [productName,setProductName]=useState('');
 const [productPrice,setProductPrice]=useState('');
 const [productStock,setProductStock]=useState('1');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState<Notice|null>(null);
 const [section,setSection]=useState<'profile'|'product'|'publish'>('profile');

 async function refresh(updateForms=false){
  const result=await api<{onboarding:SetupData}>('/api/v1/onboarding');
  const item=result.onboarding;setData(item);
  if(updateForms){
   setName(item.shop.name);setPhone(item.shop.phone);setAddress(item.shop.address);
   setDescription(item.shop.description);setShipping(String(item.shop.shipping/1000));
   setSlug(item.slug||'');
  }
 }
 useEffect(()=>{void refresh(true).catch(e=>{
  setNotice({message:e instanceof Error?e.message:'Chargement impossible',error:true});
 }).finally(()=>setLoading(false));},[]);

 async function run(callback:()=>Promise<void>,success:string,after:'profile'|'product'|'publish'|null=null){
  if(busy)return;
  setBusy(true);setNotice(null);
  try{
   await callback();
   await refresh(true);
   setNotice({message:success,error:false});
   if(after)setSection(after);
  }catch(e){setNotice({message:e instanceof Error?e.message:'Action impossible',error:true});}
  finally{setBusy(false);}
 }

 const saveProfile=(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  const fee=Math.round(Number(shipping)*1000);
  if(!Number.isFinite(fee)||fee<0){setNotice({message:'Tarif de livraison invalide',error:true});return;}
  void run(()=>api('/api/v1/onboarding','POST',{
   action:'details',name,phone,address,description,shipping:fee
  }).then(()=>{}),'Informations enregistrées. Vous pouvez ajouter vos produits.','product');
 };

 const saveSlug=(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  void run(()=>api('/api/v1/onboarding','POST',{action:'slug',slug}).then(()=>{}),'Lien public mis à jour.');
 };

 const createProduct=(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  const price=Math.round(Number(productPrice)*1000);
  const stock=Number(productStock);
  if(!Number.isSafeInteger(price)||price<=0||!Number.isSafeInteger(stock)||stock<=0){
   setNotice({message:'Vérifiez le prix et la quantité',error:true});return;
  }
  void run(async()=>{
   await api('/api/commerce','POST',{
    action:'product',requestId:crypto.randomUUID(),payload:{
     name:productName,sku:'TC-'+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase(),
     category:'Général',variant:'Standard',price,cost:0,stock,threshold:5,color:'#E5ECE6'
    }
   });
   setProductName('');setProductPrice('');setProductStock('1');
  },'Produit ajouté au catalogue !', 'publish');
 };

 const publish=(enabled:boolean)=>void run(
  ()=>api('/api/v1/onboarding','POST',{action:enabled?'publish':'unpublish'}).then(()=>{}),
  enabled?'Votre boutique est maintenant accessible aux clients.':'Votre boutique a été mise hors ligne.'
 );
 const progress=(data?.shop.phone?1:0)+(data?.shop.address?1:0)+(data?.availableCount?1:0);
 const publicUrl=data?.slug?'/boutiques/'+data.slug:null;

 return <div className={styles.shell}>
  <header className={styles.header}>
   <Link href="/marchand" className={styles.brand}><span className={styles.brandIcon}><Store size={19}/></span>TuniCommerce <small>Créateur de boutique</small></Link>
   <Link href="/marchand" className={styles.back}>Mon espace marchand <ArrowRight size={15}/></Link>
  </header>

  <main className={styles.main}>
   <div className={styles.hero}>
    <span className={styles.eyebrow}>BIENVENUE SUR TUNICOMMERCE</span>
    <h1>Lancez votre boutique en ligne</h1>
    <p>Personnalisez vos informations, ajoutez votre premier produit, puis ouvrez votre boutique aux clients avec le paiement à la livraison.</p>
   </div>
   {notice&&<div className={styles.notice+' '+(notice.error?styles.error:'')} role="status" aria-live="polite">{notice.message}</div>}
   {loading?<div className={styles.panel}>Chargement de votre boutique…</div>:data?<div className={styles.layout}>
    <section className={styles.content}>
     <div className={styles.steps} role="group" aria-label="Étapes de création">
      <button className={section==='profile'?styles.active:''} onClick={()=>setSection('profile')}><span>1</span> Boutique</button>
      <button className={section==='product'?styles.active:''} onClick={()=>setSection('product')}><span>2</span> Produits</button>
      <button className={section==='publish'?styles.active:''} onClick={()=>setSection('publish')}><span>3</span> Publication</button>
     </div>
     {section==='profile'&&<div className={styles.panel}>
      <h2>Identité de votre boutique</h2><p className={styles.help}>Ces informations s'afficheront dans votre commerce et aideront vos clients à vous contacter.</p>
      <form className={styles.form} onSubmit={saveProfile}>
       <label>Nom de la boutique<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
       <label>Téléphone du commerce<input required maxLength={30} type="tel" placeholder="+216 22 123 456" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
       <label>Adresse du commerce<input required maxLength={200} placeholder="Ville, rue, adresse" value={address} onChange={e=>setAddress(e.target.value)}/></label>
       <label>Description courte<textarea rows={3} maxLength={1000} placeholder="Présentez votre boutique..." value={description} onChange={e=>setDescription(e.target.value)}/></label>
       <label>Livraison par défaut (TND)<input required type="number" min="0" max="100000" step="0.001" value={shipping} onChange={e=>setShipping(e.target.value)}/></label>
       <button className={styles.primary} disabled={busy}><Save size={16}/> Enregistrer et continuer</button>
      </form>
      <div className={styles.separator}/>
      <h3>Adresse publique de votre boutique</h3><p className={styles.help}>Choisissez un lien court et facile à partager.</p>
      <form className={styles.linkForm} onSubmit={saveSlug}>
       <input aria-label="Identifiant boutique" required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e=>setSlug(e.target.value)} />
       <button className={styles.secondary} disabled={busy}>Modifier le lien</button>
      </form>
      <small className={styles.url}>tunicommerce-test.onrender.com/boutiques/{slug}</small>
     </div>}
     {section==='product'&&<div className={styles.panel}>
      <h2>Votre premier produit</h2><p className={styles.help}>Ajoutez un produit réel avec un prix en dinars tunisiens et une quantité disponible. Vous pourrez le personnaliser davantage dans votre espace marchand.</p>
      <form className={styles.form} onSubmit={createProduct}>
       <label>Nom du produit<input required minLength={2} maxLength={160} placeholder="Ex. T-shirt en coton" value={productName} onChange={e=>setProductName(e.target.value)}/></label>
       <div className={styles.two}>
        <label>Prix de vente (TND)<input required type="number" min="0.001" max="1000000" step="0.001" placeholder="39.900" value={productPrice} onChange={e=>setProductPrice(e.target.value)}/></label>
        <label>Quantité en stock<input required type="number" min="1" max="1000000" step="1" value={productStock} onChange={e=>setProductStock(e.target.value)}/></label>
       </div>
       <button disabled={busy} className={styles.primary}><PackagePlus size={17}/> Ajouter le produit</button>
      </form>
      <p className={styles.small}>Produits enregistrés : <strong>{data.productCount}</strong> · Disponibles : <strong>{data.availableCount}</strong></p>
      <div className={styles.separator}/>
      <Link href="/marchand" className={styles.secondary}>Gérer tout le catalogue <ArrowRight size={15}/></Link>
      <button className={styles.ghost} onClick={()=>setSection('publish')}>Continuer vers la publication <ArrowRight size={15}/></button>
     </div>}
     {section==='publish'&&<div className={styles.panel}>
      <h2>Publier votre boutique</h2>
      <p className={styles.help}>La publication rend le catalogue accessible à tous les visiteurs. Les commandes seront enregistrées dans votre espace marchand.</p>
      <div className={styles.checks}>
       <div><CheckCircle2 size={20} color={data.shop.phone?'#24855a':'#bd9b70'}/><span>Numéro de téléphone</span><strong>{data.shop.phone?'Complété':'À compléter'}</strong></div>
       <div><CheckCircle2 size={20} color={data.shop.address?'#24855a':'#bd9b70'}/><span>Adresse de boutique</span><strong>{data.shop.address?'Complétée':'À compléter'}</strong></div>
       <div><CheckCircle2 size={20} color={data.availableCount?'#24855a':'#bd9b70'}/><span>Produits disponibles</span><strong>{data.availableCount} actif(s)</strong></div>
      </div>
      {data.missing.length>0&&<p className={styles.warning}>{data.missing.join(' · ')}</p>}
      <Link href="/personnalisation" className={styles.secondary} style={{marginBottom:18}}>Personnaliser le thème, le logo et la bannière <ArrowRight size={15}/></Link>
      <div className={styles.publishBox}>
       <span className={data.published?styles.live:styles.draft}>{data.published?'Boutique en ligne':'Boutique non publiée'}</span>
       <strong>{data.shop.name}</strong>
       <small>{publicUrl||'Choisissez un lien public'}</small>
       {data.published?<div className={styles.actions}>
        {publicUrl&&<Link href={publicUrl} target="_blank" className={styles.primary}>Voir ma boutique <ExternalLink size={16}/></Link>}
        <button disabled={busy} className={styles.secondary} onClick={()=>publish(false)}>Mettre hors ligne</button>
       </div>:<button disabled={busy||!data.ready} className={styles.primary} onClick={()=>publish(true)}><Globe size={17}/> Publier maintenant</button>}
      </div>
      <p className={styles.small}><ShieldCheck size={14}/> Plan {data.plan} · Statut {data.subscriptionStatus} · Paiement à la livraison. Aucun paiement automatique n’est connecté.</p>
     </div>}
    </section>
    <aside className={styles.aside}>
     <div className={styles.panel}>
      <h3>Progression de votre boutique</h3>
      <div className={styles.progress}><span style={{width:(progress/3*100)+'%'}}/></div>
      <strong className={styles.big}>{progress}/3</strong><span className={styles.small}>Critères de lancement complétés</span>
      <div className={styles.separator}/>
      <p className={styles.small}>Un bon départ : informations complètes, produit disponible et publication contrôlée.</p>
      <button className={styles.refresh} onClick={()=>void refresh(true)} disabled={busy}><RefreshCw size={14}/> Actualiser l'état</button>
     </div>
     <div className={styles.tip}><Globe size={20}/><strong>Paiement à la livraison</strong><p>Les clients paient à réception. Le stock et les prix sont revérifiés sur le serveur lors de la commande.</p></div>
    </aside>
   </div>:<div className={styles.panel}>Aucune donnée de boutique disponible.</div>}
  </main>
 </div>;
}
