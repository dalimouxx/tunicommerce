import {getShopHome} from '../../../../modules/shops/home-service';
import ShopHomeSections from '../../../../components/shop-home-sections';
import Link from 'next/link';
import type {CSSProperties} from 'react';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../modules/shops/isolated-commerce';
import {isolatedStorefrontPreview} from '../../../../modules/shops/storefront-preview';
import {previewStorefrontTheme} from '../../../../modules/shops/storefront-themes';
import {animatedStorefrontTheme} from '../../../../modules/shops/storefront-themes';
import StorefrontMotionToggle from '../../../../components/storefront-motion-toggle';
import {money} from '../../../../modules/commerce/types';
import {badgeQuantityOffer} from '../../../../modules/shops/quantity-offers';
import PromoPrice from '../../../../components/promo-price';
import styles from '../../../vitrines/[slug]/storefront-premium.module.css';
import motion from '../../../../components/storefront-motion.module.css';
import StorefrontReveal from '../../../../components/storefront-reveal';
import ThemeMotif from '../../../../components/theme-motif';
import ThemeHeroExtras from '../../../../components/theme-hero-extras';
import {themeClass} from '../../../../components/storefront-themes';
import {storefrontLayout} from '../../../../modules/shops/theme-layouts';

export const dynamic='force-dynamic';

export default async function ShopStorefrontPreview({params,searchParams}:{params:Promise<{shopId:string}>;searchParams:Promise<{theme?:string|string[];lang?:string|string[]}>}){
 const actor=await getCurrentUser();
 if(!actor)redirect('/connexion/boutique');
 const {shopId}=await params;
 const shop=await requireIsolatedOwner(actor.userId,shopId).catch(()=>null);
 if(!shop)notFound();
 const commerce=await readIsolatedCommerce(shopId,shop.name);
 if(!commerce.initialized)notFound();
 const catalog=isolatedStorefrontPreview(commerce.state);
 const query=await searchParams;
 const home=(await getShopHome(actor.userId,shopId)).draft;
 const lang=query.lang==='ar'?'ar':'fr';
 const selection=previewStorefrontTheme(catalog.theme.code,query.theme);
 const theme=selection.theme;
 const vars={'--store-bg':theme.background,'--store-text':theme.foreground,
  '--store-accent':theme.accent,'--store-accent-text':theme.accentText,
  '--store-surface':theme.surface,'--store-muted':theme.muted} as CSSProperties;
 const first=catalog.products.find(p=>p.imageUrl)||catalog.products[0];
 const layout=storefrontLayout(theme.code);
 const categories=[...new Set(catalog.products.map(product=>product.category).filter(Boolean))].slice(0,5);
 return <main className={[styles.page,motion.root,themeClass(theme.code)].filter(Boolean).join(' ')} data-motion-root data-theme={theme.code} data-hero={layout.hero} data-cards={layout.cards} data-motif={layout.motif} style={vars} lang={lang} dir={lang==='ar'?'rtl':'ltr'}>
  <StorefrontReveal/>
  <div className={styles.previewWarning}>
   <strong>APERÇU PRIVÉ · Thème {theme.name}{selection.temporary?' · non enregistré':''}</strong>
   {animatedStorefrontTheme(theme.code)&&<StorefrontMotionToggle className={styles.motionControl}/>}
   <span>{selection.temporary?'Essai temporaire : votre thème actif reste inchangé.':'Visible uniquement par le propriétaire.'} Les commandes sont désactivées ici. Textes et sections : brouillon enregistré, non publié.</span>
   <Link href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/accueil'}>Modifier le brouillon de l’accueil</Link>
   <Link href={'/mes-boutiques/'+encodeURIComponent(shopId)+'#espace=growth'}>Retour à mes thèmes</Link>
  </div>
  <div className={styles.container}>
   {home[lang].announcement&&<div className={styles.announcement} data-part="announcement" dir="auto">{home[lang].announcement}</div>}
   <header className={styles.storeHeader} data-part="header">
    <span className={styles.identity}><span className={styles.fallbackLogo}>{catalog.name.slice(0,1)}</span>
     <span className={styles.brandText}><strong>{catalog.name}</strong>
      <small>Boutique indépendante · Tunisie</small></span></span>
    <nav className={styles.nav}><span>Collections</span><span className={styles.navCart}>Panier privé désactivé</span></nav>
   </header>
   <section className={styles.hero} data-part="hero">
    <ThemeMotif motif={layout.motif}/>
    <div className={styles.heroCopy} data-part="hero-copy"><span className={styles.kicker}>NOUVELLE COLLECTION</span>
     <h1 dir="auto">{home[lang].heroTitle||catalog.name}</h1>
     <p className={styles.heroDescription}>{home[lang].heroDescription||catalog.description||'Découvrez les articles de notre boutique.'}</p>
     <span className={styles.primaryAction} data-part="cta">Aperçu du design</span>
    </div>
    <div className={styles.heroVisual} data-part="hero-visual">
     {(catalog.bannerUrl||first?.imageUrl)?
      <img src={catalog.bannerUrl||first!.imageUrl} alt="Visuel de ma boutique"
       loading="lazy" referrerPolicy="no-referrer" className={styles.heroImage}/>:
      <div className={styles.heroAbstract} aria-hidden="true">✦</div>}
     <ThemeHeroExtras layout={layout} products={catalog.products} categories={categories} lang={lang} shopPath="" hrefFor={()=>'#catalogue'}/>
    </div>
   </section>
   {home.showBenefits&&<section className={styles.pillars} data-part="pillars" data-reveal>
    <div><span aria-hidden="true">✧</span><strong>Collection</strong><small>Vos produits</small></div>
    <div><span aria-hidden="true">◈</span><strong>Paiement à la livraison</strong><small>Configuré à la commande</small></div>
    <div><span aria-hidden="true">✦</span><strong>Suivi</strong><small>Statuts après commande</small></div>
   </section>}
   {home.sectionsPosition==='beforeCatalog'&&<ShopHomeSections content={home} lang={lang} preview/>}
   <section id="catalogue" className={styles.catalogue} aria-label="Aperçu des produits de ma boutique">
    <div className={styles.sectionHeading}><h2>Explorer la collection</h2></div>
    <div className={styles.productGrid} data-part="product-grid">{catalog.products.slice(0,12).map((product,index)=>
     <article key={product.id} className={styles.productCard} data-part="product-card" data-reveal style={{'--i':index} as CSSProperties}>
      <div className={styles.productImageWrap} data-part="product-media">{product.imageUrl?
       <img src={product.imageUrl} alt={'Photo de '+product.name} loading="lazy" referrerPolicy="no-referrer"/>:
       <span className={styles.productPlaceholder} aria-hidden="true">✧</span>}
      </div>
      <div className={styles.productBody}><span className={styles.productCategory}>{product.category}</span>
       <h3>{product.name}</h3><p className={styles.productPrice}><PromoPrice price={product.price} promotion={product.promotion} lang={lang}/></p>
       {(offer=>offer&&<p data-part="offer-badge">{offer.quantity} pièces · {money(offer.price)} TND</p>)(badgeQuantityOffer(product.offers))}
       <button type="button" disabled className={styles.previewDisabled}>Commander · aperçu uniquement</button>
      </div>
     </article>)}</div>
    {catalog.products.length===0&&<div className={styles.emptyState}>
     <h2>Catalogue vide</h2><p>Ajoutez vos produits depuis l'administration boutique.</p>
    </div>}
   </section>
   {home.sectionsPosition==='afterCatalog'&&<ShopHomeSections content={home} lang={lang} preview/>}
   <footer className={styles.footer} data-part="footer" data-reveal><strong>{catalog.name}</strong><p>Aperçu non public · aucune commande ne peut être créée ici.</p></footer>
  </div>
 </main>;
}


