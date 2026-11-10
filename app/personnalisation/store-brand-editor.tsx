'use client';
import {useEffect,useState,type CSSProperties,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,ExternalLink,Image as ImageIcon,LayoutTemplate,Palette,Save,ShieldCheck,ShoppingBag,Smartphone,Store} from 'lucide-react';
import styles from './brand-editor.module.css';
import {accents,defaultPresentation,themes,type AppearanceInput,type StoreTheme} from '../../modules/appearance/validation';

const themeNames:Record<StoreTheme,{name:string,description:string}>={
 classic:{name:'Essentiel',description:'Épuré et polyvalent, idéal pour démarrer.'},
 editorial:{name:'Éditorial',description:'Chic, chaleureux, avec des titres élégants.'},
 prestige:{name:'Prestige',description:'Fond sombre, présentation haut de gamme.'},
 pop:{name:'Pop',description:'Couleurs et formes modernes, style dynamique.'}
};
const paletteLabels:Record<string,string>={
 '#21815F':'Vert émeraude','#244A77':'Bleu nuit','#893F49':'Rouge brique',
 '#633D81':'Violet','#A0511D':'Terracotta','#293442':'Gris ardoise'
};
const empty:AppearanceInput={
 ...defaultPresentation,logoUrl:'',bannerUrl:'',description:''
};
type ShopBrand={
 appearance:AppearanceInput,shopName:string,slug:string|null,published:boolean,
 logoUrl:string,bannerUrl:string,description:string
};
type Sample={name:string,price:number,imageUrl:string};
type ShopBrandWithSamples=ShopBrand&{sampleProducts:Sample[]};

export default function StoreBrandEditor(){
 const [data,setData]=useState<ShopBrandWithSamples|null>(null);
 const [form,setForm]=useState<AppearanceInput>(empty);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [uploading,setUploading]=useState<'logo'|'banner'|null>(null);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [mobile,setMobile]=useState(false);

 useEffect(()=>{
  let mounted=true;
  void fetch('/api/v1/appearance',{cache:'no-store'}).then(async response=>{
   const result=await response.json() as {store?:ShopBrandWithSamples,error?:string};
   if(!response.ok||!result.store)throw new Error(result.error||'Boutique indisponible');
   if(!mounted)return;
   setData(result.store);
   setForm({
    ...result.store.appearance,
    logoUrl:result.store.logoUrl,bannerUrl:result.store.bannerUrl,
    description:result.store.description
   });
  }).catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Chargement impossible');})
   .finally(()=>{if(mounted)setLoading(false);});
  return ()=>{mounted=false;};
 },[]);

 const change=<K extends keyof AppearanceInput>(field:K,value:AppearanceInput[K])=>{
  setForm(old=>({...old,[field]:value}));
  setError('');setSuccess('');
 };

 async function upload(slot:'logo'|'banner',file:File){
  if(uploading||busy)return;
  const max=slot==='logo'?700*1024:2*1024*1024;
  if(file.size===0||file.size>max){
   setError('Image trop volumineuse. Logo : 700 Ko maximum ; bannière : 2 Mo maximum.');
   return;
  }
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){
   setError('Utilisez une image PNG, JPEG ou WebP.');
   return;
  }
  setUploading(slot);setError('');setSuccess('');
  try{
   const response=await fetch('/api/v1/media/'+slot,{
    method:'PUT',headers:{'content-type':file.type},body:file
   });
   const result=await response.json() as {url?:string,error?:string};
   if(!response.ok||!result.url)throw new Error(result.error||'Importation impossible');
   setForm(previous=>({
    ...previous,[slot==='logo'?'logoUrl':'bannerUrl']:result.url!
   }));
   setSuccess(slot==='logo'?'Logo importé et enregistré.':'Bannière importée et enregistrée.');
  }catch(e){
   setError(e instanceof Error?e.message:'Importation indisponible');
  }finally{setUploading(null);}
 }

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/v1/appearance',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(form)
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Enregistrement impossible');
   setSuccess('Personnalisation enregistrée. Votre boutique utilise désormais ces réglages.');
  }catch(e){setError(e instanceof Error?e.message:'Erreur d’enregistrement');}
  finally{setBusy(false);}
 }

 const sample=data?.sampleProducts?.length?data.sampleProducts:[
  {name:'Produit exemple',price:39900,imageUrl:''},
  {name:'Nouvelle collection',price:69900,imageUrl:''}
 ];
 const style={'--brand-preview':form.accent} as CSSProperties;
 const themeStyle=form.theme==='prestige'?styles.prestige:form.theme==='editorial'?styles.editorial:form.theme==='pop'?styles.pop:styles.classic;

 return <div className={styles.shell}>
  <header className={styles.header}>
   <Link href="/marchand" className={styles.brand}><span><Store size={19}/></span>Tunicom <small>Studio créatif</small></Link>
   <Link href="/marchand" className={styles.back}><ArrowLeft size={15}/> Tableau de bord</Link>
  </header>
  <main className={styles.main}>
   <div className={styles.intro}>
    <div><p className={styles.eyebrow}>CRÉATEUR DE BOUTIQUE PREMIUM</p>
     <h1>Imaginez votre vitrine</h1>
     <p>Choisissez une identité visuelle qui vous ressemble. Vos produits, commandes et données clients restent inchangés.</p>
    </div>
    {data?.slug&&data.published&&<Link href={'/boutiques/'+data.slug} target="_blank" className={styles.viewLive}>Voir la boutique <ExternalLink size={16}/></Link>}
   </div>
   {loading?<div className={styles.panel}>Chargement de votre studio de personnalisation…</div>:
    <div className={styles.layout}>
     <form className={styles.settings} onSubmit={save}>
      <section className={styles.panel}>
       <div className={styles.sectionHead}><span className={styles.sectionIcon}><LayoutTemplate size={18}/></span><div><h2>1. Choisir un thème</h2><p>Quatre mises en page adaptées aux écrans mobiles.</p></div></div>
       <div className={styles.themes}>
        {themes.map(theme=><button type="button" key={theme} onClick={()=>change('theme',theme)} aria-pressed={form.theme===theme}
          className={styles.themeChoice+' '+(form.theme===theme?styles.selected:'')}>
          <span className={styles.mini+' '+(theme==='prestige'?styles.miniDark:theme==='editorial'?styles.miniEditorial:theme==='pop'?styles.miniPop:styles.miniClassic)}>
           <i/><i/><i/>
          </span>
          <span className={styles.themeName}>{themeNames[theme].name}{form.theme===theme&&<Check size={15}/>}</span>
          <span className={styles.themeDescription}>{themeNames[theme].description}</span>
         </button>)}
       </div>
      </section>
      <section className={styles.panel}>
       <div className={styles.sectionHead}><span className={styles.sectionIcon}><Palette size={18}/></span><div><h2>2. Palette de couleurs</h2><p>Couleurs sélectionnées pour conserver des boutons lisibles.</p></div></div>
       <div className={styles.colors}>
        {accents.map(color=><button type="button" key={color} className={styles.colorCircle+(form.accent===color?' '+styles.colorSelected:'')}
         style={{backgroundColor:color}} aria-label={paletteLabels[color]} title={paletteLabels[color]} aria-pressed={form.accent===color}
         onClick={()=>change('accent',color)}>{form.accent===color&&<Check size={19} color="white"/>}</button>)}
       </div>
       <p className={styles.helper}>Couleur actuelle : {paletteLabels[form.accent]}</p>
      </section>
      <section className={styles.panel}>
       <div className={styles.sectionHead}><span className={styles.sectionIcon}><ImageIcon size={18}/></span><div><h2>3. Logo et bannière</h2><p>Importez vos fichiers directement, ou indiquez une adresse HTTPS.</p></div></div>
       <div className={styles.fields}>
        <label htmlFor="logo-file">Importer un logo <small>PNG, JPG, WebP · maximum 700 Ko</small></label>
        <input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp"
         disabled={busy||uploading!==null}
         onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void upload('logo',file);}}/>
        {uploading==='logo'&&<p className={styles.helper} role="status">Importation du logo…</p>}
        <label htmlFor="logo-url">Lien du logo <small>HTTPS · PNG, JPG ou WebP recommandé</small></label>
        <input id="logo-url" type="text" maxLength={2000} value={form.logoUrl} onChange={e=>change('logoUrl',e.target.value)} placeholder="https://exemple.tn/logo.png"/>
        <label htmlFor="banner-file">Importer une bannière <small>PNG, JPG, WebP · maximum 2 Mo</small></label>
        <input id="banner-file" type="file" accept="image/png,image/jpeg,image/webp"
         disabled={busy||uploading!==null}
         onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void upload('banner',file);}}/>
        {uploading==='banner'&&<p className={styles.helper} role="status">Importation de la bannière…</p>}
        <label htmlFor="banner-url">Lien de la bannière <small>Image panoramique, idéalement 1600 × 600</small></label>
        <input id="banner-url" type="text" maxLength={2000} value={form.bannerUrl} onChange={e=>change('bannerUrl',e.target.value)} placeholder="https://exemple.tn/banniere.webp"/>
       </div>
       <p className={styles.helper}>Les fichiers importés sont enregistrés directement pour cette boutique. Les liens HTTPS externes restent acceptés. Cette première version limite le stockage aux petits visuels de marque.</p>
      </section>
      <section className={styles.panel}>
       <div className={styles.sectionHead}><span className={styles.sectionIcon}><ShoppingBag size={18}/></span><div><h2>4. Texte de votre vitrine</h2><p>Votre nom de boutique reste celui configuré dans l’espace marchand.</p></div></div>
       <div className={styles.fields}>
        <label htmlFor="tagtop">Message de bienvenue</label>
        <input id="tagtop" maxLength={85} value={form.eyebrow} onChange={e=>change('eyebrow',e.target.value)} placeholder="LA NOUVELLE COLLECTION"/>
        <label htmlFor="tagline">Promesse de la boutique</label>
        <input id="tagline" maxLength={160} value={form.tagline} onChange={e=>change('tagline',e.target.value)} placeholder="Vos envies, livrées partout en Tunisie"/>
        <label htmlFor="desc">Description de la boutique</label>
        <textarea id="desc" rows={3} maxLength={1000} value={form.description} onChange={e=>change('description',e.target.value)} placeholder="Décrivez les produits et les valeurs de votre boutique…"/>
       </div>
      </section>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      {success&&<p className={styles.success} role="status"><CheckCircle2 size={17}/>{success}</p>}
      <button type="submit" className={styles.save} disabled={busy||uploading!==null||!data}><Save size={17}/>{busy?'Enregistrement…':'Enregistrer le design'}</button>
      <p className={styles.footnote}><ShieldCheck size={15}/> Chaque boutique conserve sa propre identité. Le checkout COD et le suivi des commandes restent inchangés.</p>
     </form>

     <aside className={styles.previewPanel}>
      <div className={styles.previewHeader}>
       <div><h2>Aperçu de la vitrine</h2><p>Prévisualisation avant enregistrement</p></div>
       <button type="button" className={styles.device} onClick={()=>setMobile(!mobile)} aria-pressed={mobile}>
        <Smartphone size={16}/>{mobile?'Vue normale':'Vue mobile'}
       </button>
      </div>
      <div className={styles.previewShell+(mobile?' '+styles.previewMobile:'')} style={style}>
       <div className={styles.mock+' '+themeStyle}>
        <div className={styles.mockAnnouncement}>{form.eyebrow||'BOUTIQUE EN TUNISIE'}</div>
        <div className={styles.mockNav}><span className={styles.mockBrand}>
         {form.logoUrl?<img src={form.logoUrl} alt="Aperçu du logo" referrerPolicy="no-referrer"/>:<Store size={18}/>}
         {data?.shopName||'Ma boutique'}</span><span>Panier · 0</span></div>
        {form.bannerUrl&&<div className={styles.mockBanner}><img src={form.bannerUrl} alt="Aperçu de la bannière" referrerPolicy="no-referrer"/></div>}
        <div className={styles.mockHero}><span>COLLECTIONS EN LIGNE</span><h2>{data?.shopName||'Votre nouvelle boutique'}</h2><p>{form.description||form.tagline||'Votre sélection de produits, livrée en Tunisie.'}</p></div>
        <div className={styles.mockProducts}>{sample.slice(0,3).map((product,i)=><div key={i} className={styles.mockProduct}>
         {product.imageUrl?<img src={product.imageUrl} alt="" referrerPolicy="no-referrer"/>:<div className={styles.mockArt}><ShoppingBag size={27}/></div>}
         <strong>{product.name}</strong><small>{new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3}).format(product.price/1000)} TND</small>
         <div className={styles.mockButton}>Ajouter au panier <ArrowRight size={12}/></div>
        </div>)}</div>
        <div className={styles.mockFooter}>{form.tagline||'Paiement à la livraison · Tunisie'}</div>
       </div>
      </div>
      <p className={styles.previewNote}>L’aperçu est décoratif et ne crée aucune commande. Le vrai catalogue et le panier conservent toutes leurs fonctions sur la boutique publiée.</p>
      <Link href="/demarrage" className={styles.editorLink}>Configurer la boutique et publier <ArrowRight size={15}/></Link>
     </aside>
    </div>}
  </main>
 </div>;
}
