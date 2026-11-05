import Link from 'next/link';
import type {CSSProperties} from 'react';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../modules/shops/isolated-commerce';
import {isolatedStorefrontPreview} from '../../../../modules/shops/storefront-preview';
import {previewStorefrontTheme} from '../../../../modules/shops/storefront-themes';
import {money} from '../../../../modules/commerce/types';
import styles from '../../../vitrines/[slug]/storefront-premium.module.css';

export const dynamic='force-dynamic';

export default async function ShopStorefrontPreview({params,searchParams}:{params:Promise<{shopId:string}>;searchParams:Promise<{theme?:string|string[]}>}){
 const actor=await getCurrentUser();
 if(!actor)redirect('/connexion/boutique');
 const {shopId}=await params;
 const shop=await requireIsolatedOwner(actor.userId,shopId).catch(()=>null);
 if(!shop)notFound();
 const commerce=await readIsolatedCommerce(shopId,shop.name);
 if(!commerce.initialized)notFound();
 const catalog=isolatedStorefrontPreview(commerce.state);
 const query=await searchParams;
 const selection=previewStorefrontTheme(catalog.theme.code,query.theme);
 const theme=selection.theme;
 const vars={'--store-bg':theme.background,'--store-text':theme.foreground,
  '--store-accent':theme.accent,'--store-accent-text':theme.accentText,
  '--store-surface':theme.surface,'--store-muted':theme.muted} as CSSProperties;
 const first=catalog.products.find(p=>p.imageUrl)||catalog.products[0];
 return <main className={styles.page} data-theme={theme.code} style={vars}>
  <div className={styles.previewWarning}>
   <strong>APERÇU PRIVÉ · Thème {theme.name}{selection.temporary?' · non enregistré':''}</strong>
   <span>{selection.temporary?'Essai temporaire : votre thème actif reste inchangé.':'Visible uniquement par le propriétaire.'} Les commandes sont désactivées ici.</span>
   <Link href={'/mes-boutiques/'+encodeURIComponent(shopId)+'#espace=growth'}>Retour à mes thèmes</Link>
  </div>
  <div className={styles.container}>
   <header className={styles.storeHeader}>
    <span className={styles.identity}><span className={styles.fallbackLogo}>{catalog.name.slice(0,1)}</span>
     <span className={styles.brandText}><strong>{catalog.name}</strong>
      <small>Boutique indépendante · Tunisie</small></span></span>
    <nav className={styles.nav}><span>Collections</span><span className={styles.navCart}>Panier privé désactivé</span></nav>
   </header>
   <section className={styles.hero}>
    <div className={styles.heroCopy}><span className={styles.kicker}>NOUVELLE COLLECTION</span>
     <h1>{catalog.name}</h1>
     <p className={styles.heroDescription}>{catalog.description||'Découvrez les articles de notre boutique.'}</p>
     <span className={styles.primaryAction}>Aperçu du design</span>
    </div>
    <div className={styles.heroVisual}>
     {(catalog.bannerUrl||first?.imageUrl)?
      <img src={catalog.bannerUrl||first!.imageUrl} alt="Visuel de ma boutique"
       loading="lazy" referrerPolicy="no-referrer" className={styles.heroImage}/>:
      <div className={styles.heroAbstract} aria-hidden="true">✦</div>}
    </div>
   </section>
   <section className={styles.pillars}>
    <div><span aria-hidden="true">✧</span><strong>Collection</strong><small>Vos produits</small></div>
    <div><span aria-hidden="true">◈</span><strong>Paiement à la livraison</strong><small>Configuré à la commande</small></div>
    <div><span aria-hidden="true">✦</span><strong>Suivi</strong><small>Statuts après commande</small></div>
   </section>
   <section className={styles.catalogue} aria-label="Aperçu des produits de ma boutique">
    <div className={styles.sectionHeading}><h2>Explorer la collection</h2></div>
    <div className={styles.productGrid}>{catalog.products.slice(0,12).map(product=>
     <article key={product.id} className={styles.productCard}>
      <div className={styles.productImageWrap}>{product.imageUrl?
       <img src={product.imageUrl} alt={'Photo de '+product.name} loading="lazy" referrerPolicy="no-referrer"/>:
       <span className={styles.productPlaceholder} aria-hidden="true">✧</span>}
      </div>
      <div className={styles.productBody}><span className={styles.productCategory}>{product.category}</span>
       <h3>{product.name}</h3><p className={styles.productPrice}>{money(product.price)} TND</p>
       <button type="button" disabled className={styles.previewDisabled}>Commander · aperçu uniquement</button>
      </div>
     </article>)}</div>
    {catalog.products.length===0&&<div className={styles.emptyState}>
     <h2>Catalogue vide</h2><p>Ajoutez vos produits depuis l'administration boutique.</p>
    </div>}
   </section>
   <footer className={styles.footer}><strong>{catalog.name}</strong><p>Aperçu non public · aucune commande ne peut être créée ici.</p></footer>
  </div>
 </main>;
}
