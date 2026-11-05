'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {storefrontThemeCodes,storefrontPalette,type StorefrontThemeCode} from '../../../modules/shops/storefront-themes';
import styles from './storefront-theme-gallery.module.css';

export default function ShopStorefrontThemes({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/storefront-theme';
 const [active,setActive]=useState<StorefrontThemeCode>('OASIS');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json() as {theme?:{code:StorefrontThemeCode};error?:string};
   if(!response.ok)throw Error(data.error||'Thèmes indisponibles');
   if(!controller.signal.aborted&&data.theme)setActive(data.theme.code);
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url]);
 async function save(theme:StorefrontThemeCode){
  if(theme===active||busy)return;
  setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'saveStorefrontTheme',payload:{theme},requestId:crypto.randomUUID()})
   });
   const data=await response.json() as {theme?:{code:StorefrontThemeCode};error?:string};
   if(!response.ok)throw Error(data.error||'Enregistrement impossible');
   setActive(data.theme?.code||theme);
   setNotice('Thème '+storefrontPalette(theme).name+' enregistré. Visualisez-le dans l’aperçu privé avant publication.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau');}
  finally{setBusy(false);}
 }
 return <section className={styles.gallery} aria-labelledby="storefront-theme-title">
  <header className={styles.header}>
   <div><p className={styles.eyebrow}>PERSONNALISATION DE VOTRE VITRINE</p>
    <h2 id="storefront-theme-title">Les thèmes TuniCommerce Studio</h2>
    <p>Dix univers professionnels avec mise en page responsive, collection produits et checkout tunisien. Choisissez un design sans modifier vos produits, stocks ni commandes.</p>
   </div>
   <Link href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/apercu'}
    className={styles.previewLink}>Voir mon aperçu privé</Link>
  </header>
  <div className={styles.grid}>
   {storefrontThemeCodes.map(code=>{
    const t=storefrontPalette(code);
    return <article key={code} className={styles.themeCard} data-active={active===code}>
     <div className={styles.miniSite} data-theme={code} style={{
      background:t.background,color:t.foreground,
      ['--preview-accent' as string]:t.accent,
      ['--preview-accent-text' as string]:t.accentText,
      ['--preview-surface' as string]:t.surface
     }}>
      <div className={styles.miniAnnouncement}>TUNICOMMERCE · PAIEMENT À LA LIVRAISON</div>
      <div className={styles.miniHeader}><span className={styles.miniLogo}>S</span><span>Votre boutique</span><span>☰</span></div>
      <div className={styles.miniHero}>
       <div><small>NOUVELLE COLLECTION</small><strong>Découvrez votre univers.</strong>
        <span className={styles.miniButton}>Explorer</span></div>
       <div className={styles.miniHeroVisual}><span>✦</span></div>
      </div>
      <div className={styles.miniProducts}>
       <div><span className={styles.miniPhoto}>◈</span><small>Produit premium</small><strong>49,000 TND</strong></div>
       <div><span className={styles.miniPhoto}>◇</span><small>Nouvelle sélection</small><strong>79,000 TND</strong></div>
       <div><span className={styles.miniPhoto}>✧</span><small>Incontournable</small><strong>29,000 TND</strong></div>
      </div>
     </div>
     <div className={styles.themeFooter}>
      <div><h3>{t.name} {active===code&&<span className={styles.activeTag}>Actif</span>}</h3>
       <p>{t.description}</p></div>
      <div className={styles.themeActions}>
       <Link href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/apercu?theme='+code}
        className={styles.tryTheme}>Essayer sans enregistrer</Link>
       <button type="button" disabled={loading||busy||active===code}
        onClick={()=>void save(code)}>
        {active===code?'Thème sélectionné':busy?'Enregistrement…':'Choisir ce thème'}
       </button>
      </div>
     </div>
    </article>;
   })}
  </div>
  {notice&&<p role="status" aria-live="polite" className={styles.notice}>{notice}</p>}
  <p className={styles.footnote}>Chaque thème peut être essayé dans votre aperçu privé sans modifier la boutique publique. Les exemples ci-dessus illustrent le design ; les prix, visuels et produits réels viennent uniquement de votre propre boutique. Aucun CSS externe ou script marchand n’est exécuté.</p>
 </section>;
}
