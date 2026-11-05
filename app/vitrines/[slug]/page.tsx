import {notFound} from 'next/navigation';
import Link from 'next/link';
import type {CSSProperties} from 'react';
import type {Metadata} from 'next';
import PublicCart from './public-cart';
import CatalogBrowser from './catalog-browser';
import StorefrontPixels from './storefront-pixels';
import {whatsappLink} from '../../../modules/shops/storefront-marketing';
import {prisma} from '../../../modules/storage/client';
import {isPublicIsolatedShop} from '../../../modules/shops/publication';
import {isolatedStorefrontPreview} from '../../../modules/shops/storefront-preview';
import {normalizeState} from '../../../modules/commerce/normalize';
import type {State} from '../../../modules/commerce/types';
import styles from './storefront-premium.module.css';

export const dynamic='force-dynamic';

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 const shop=await prisma.shop.findUnique({where:{slug},select:{name:true,status:true,legacyWorkspaceId:true,
  commerce:{select:{data:true}},organization:{select:{owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}}}});
 const subscription=shop?.organization.owner.workspace;
 if(!shop||!isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,
  initialized:!!shop.commerce,subscriptionStatus:subscription?.subscriptionStatus||'',
  subscriptionEndsAt:subscription?.subscriptionEndsAt||null}))return {title:'Boutique indisponible',robots:{index:false,follow:false}};
 const preview=isolatedStorefrontPreview(normalizeState(shop.commerce!.data as unknown as State));
 const title=(preview.name||shop.name).slice(0,120);
 const description=(preview.description||'Boutique tunisienne · paiement à la livraison').slice(0,160);
 return {title,description,robots:{index:true,follow:true},openGraph:{title,description,type:'website'}};
}


export default async function IsolatedPublicStorefront({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{produit?:string}>}){
 const {slug}=await params;
 const query=await searchParams;
 const productToAdd=typeof query.produit==='string'?query.produit:undefined;
 const shop=await prisma.shop.findUnique({where:{slug},select:{
  name:true,status:true,legacyWorkspaceId:true,
  commerce:{select:{data:true}},
  organization:{select:{owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}}
 }});
 const subscription=shop?.organization.owner.workspace;
 if(!shop||!isPublicIsolatedShop({
  status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,
  initialized:!!shop.commerce,
  subscriptionStatus:subscription?.subscriptionStatus||'',
  subscriptionEndsAt:subscription?.subscriptionEndsAt||null
 }))notFound();
 const catalog=isolatedStorefrontPreview(normalizeState(shop.commerce!.data as unknown as State));
 const theme=catalog.theme;
 const heroProduct=catalog.products.find(p=>p.available&&p.imageUrl)||
  catalog.products.find(p=>p.available)||catalog.products[0];
 const names=[...new Set(catalog.products.map(product=>product.category).filter(Boolean))].slice(0,5);
 const publicBase='/vitrines/'+encodeURIComponent(slug);
 const whatsappHref=whatsappLink(catalog.marketing.whatsapp,catalog.marketing.whatsappMessage||'Bonjour, j’ai une question sur vos produits.');
 const vars={
  '--store-bg':theme.background,'--store-text':theme.foreground,
  '--store-accent':theme.accent,'--store-accent-text':theme.accentText,
  '--store-surface':theme.surface,'--store-muted':theme.muted
 } as CSSProperties;
 return <main className={styles.page} data-theme={theme.code} style={vars}>
  <StorefrontPixels metaPixelId={catalog.marketing.metaPixelId} tiktokPixelId={catalog.marketing.tiktokPixelId}/>
  <div className={styles.announcement}>
   <span>Livraison selon les zones de la boutique</span>
   <span aria-hidden="true">✦</span>
   <span>Paiement à la livraison en TND</span>
  </div>
  <div className={styles.container}>
   <header className={styles.storeHeader}>
    <Link className={styles.identity} href={publicBase} aria-label={'Accueil '+(catalog.name||shop.name)}>
     {catalog.logoUrl?<img src={catalog.logoUrl} alt="" width={52} height={52}
      referrerPolicy="no-referrer" className={styles.logo}/>:
      <span className={styles.fallbackLogo}>{(catalog.name||shop.name).slice(0,1).toLocaleUpperCase('fr')}</span>}
     <span className={styles.brandText}><strong>{catalog.name||shop.name}</strong>
      <small>Boutique indépendante · Tunisie</small></span>
    </Link>
    <nav className={styles.nav} aria-label="Navigation de la boutique">
     <a href="#catalogue">Collections</a>
     {catalog.products.length>0&&<a href="#panier" className={styles.navCart}>Mon panier</a>}
    </nav>
   </header>
   <section className={styles.hero} aria-labelledby="storefront-title">
    <div className={styles.heroCopy}>
     <span className={styles.kicker}>TUNICOMMERCE STUDIO · COLLECTIONS</span>
     <h1 id="storefront-title">{catalog.name||shop.name}</h1>
     <p className={styles.heroDescription}>{catalog.description||'Une sélection de produits pour vous, avec une expérience d’achat simple et un paiement à la livraison.'}</p>
     <div className={styles.heroActions}>
      <a href="#catalogue" className={styles.primaryAction}>Découvrir la collection <span aria-hidden="true">↗</span></a>
      {catalog.products.length>0&&<a href="#panier" className={styles.secondaryAction}>Commander en ligne</a>}
     </div>
     {names.length>0&&<div className={styles.heroCategories} aria-label="Catégories proposées">
      {names.map(name=><span key={name}>{name}</span>)}
     </div>}
    </div>
    <div className={styles.heroVisual}>
     {catalog.bannerUrl?<img src={catalog.bannerUrl}
      alt={'Bannière de '+(catalog.name||shop.name)} loading="eager" decoding="async"
      referrerPolicy="no-referrer" className={styles.heroImage}/>:
      heroProduct?.imageUrl?<img src={heroProduct.imageUrl}
       alt={'Produit sélectionné : '+heroProduct.name} loading="eager" decoding="async"
       referrerPolicy="no-referrer" className={styles.heroImage}/>:
       <div className={styles.heroAbstract} aria-hidden="true"><span>✦</span><span>TC</span></div>}
     {heroProduct&&<div className={styles.featuredBadge}>
      <span>Sélection de la boutique</span>
      <strong>{heroProduct.name}</strong>
      <small>{(heroProduct.price/1000).toFixed(3)} TND</small>
     </div>}
    </div>
   </section>
   <section className={styles.pillars} aria-label="Informations de commande">
    <div><span aria-hidden="true">✧</span><strong>Choix sélectionné</strong><small>Produits proposés par cette boutique</small></div>
    <div><span aria-hidden="true">◈</span><strong>Paiement à la livraison</strong><small>Pas de paiement en ligne à effectuer</small></div>
    <div><span aria-hidden="true">✦</span><strong>Commande suivie</strong><small>Référence et lien confidentiel après validation</small></div>
   </section>
   <CatalogBrowser slug={slug} products={catalog.products}/>
   {catalog.products.length>0&&<PublicCart slug={slug} initialProductId={productToAdd}
    shipping={catalog.shipping} zones={catalog.zones}
    products={catalog.products.map(product=>({id:product.id,name:product.name,
     variant:product.variant,price:product.price,available:product.available}))}
    theme={theme}/>}
   {whatsappHref&&<a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={styles.whatsappFloat} aria-label="Contacter la boutique sur WhatsApp">
    <span aria-hidden="true">💬</span><b>WhatsApp</b></a>}
   {catalog.products.length===0&&<div className={styles.emptyState}>
    <h2>Bientôt disponible</h2>
    <p>Cette boutique prépare actuellement sa collection.</p>
   </div>}
   <footer className={styles.footer}>
    <div><strong>{catalog.name||shop.name}</strong><p>Commerce tunisien indépendant · Paiement à la livraison</p></div>
    <div>{catalog.phone&&<span>Contact marchand : {catalog.phone}</span>}
     <span>Les conditions de livraison et les prix sont confirmés lors de la commande.</span></div>
   </footer>
  </div>
 </main>;
}
