import {notFound} from 'next/navigation';
import {cookies} from 'next/headers';
import Link from 'next/link';
import type {CSSProperties} from 'react';
import type {Metadata} from 'next';
import PublicCart from './public-cart';
import CatalogBrowser from './catalog-browser';
import StorefrontPixels from './storefront-pixels';
import {whatsappLink} from '../../../modules/shops/storefront-marketing';
import LanguageSwitch from './language-switch';
import {arabicFont} from './arabic-font';
import {STOREFRONT_LANG_COOKIE,formatStorefrontMoney,resolveStorefrontLang,storefrontDictionary,storefrontDir,storefrontLangHref} from '../../../modules/shops/storefront-i18n';
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


export default async function IsolatedPublicStorefront({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{produit?:string;lang?:string}>}){
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
 const lang=resolveStorefrontLang(query.lang,(await cookies()).get(STOREFRONT_LANG_COOKIE)?.value,catalog.marketing.language);
 const t=storefrontDictionary(lang);
 const theme=catalog.theme;
 const heroProduct=catalog.products.find(p=>p.available&&p.imageUrl)||
  catalog.products.find(p=>p.available)||catalog.products[0];
 const names=[...new Set(catalog.products.map(product=>product.category).filter(Boolean))].slice(0,5);
 const publicBase='/vitrines/'+encodeURIComponent(slug);
 const shopName=catalog.name||shop.name;
 const whatsappHref=whatsappLink(catalog.marketing.whatsapp,catalog.marketing.whatsappMessage||t.whatsappShopMessage);
 const vars={
  '--store-bg':theme.background,'--store-text':theme.foreground,
  '--store-accent':theme.accent,'--store-accent-text':theme.accentText,
  '--store-surface':theme.surface,'--store-muted':theme.muted
 } as CSSProperties;
 return <main className={styles.page+' '+arabicFont.variable} data-theme={theme.code} style={vars} lang={lang} dir={storefrontDir(lang)}>
  <StorefrontPixels metaPixelId={catalog.marketing.metaPixelId} tiktokPixelId={catalog.marketing.tiktokPixelId}/>
  <div className={styles.announcement}>
   <span>{t.announcementZones}</span>
   <span aria-hidden="true">✦</span>
   <span>{t.announcementCod}</span>
  </div>
  <div className={styles.container}>
   <header className={styles.storeHeader}>
    <Link className={styles.identity} href={publicBase} aria-label={t.home(shopName)}>
     {catalog.logoUrl?<img src={catalog.logoUrl} alt="" width={52} height={52}
      referrerPolicy="no-referrer" className={styles.logo}/>:
      <span className={styles.fallbackLogo}>{shopName.slice(0,1).toLocaleUpperCase('fr')}</span>}
     <span className={styles.brandText}><strong>{shopName}</strong>
      <small>{t.independentShop}</small></span>
    </Link>
    <nav className={styles.nav} aria-label={t.navCollections}>
     <a href="#catalogue">{t.navCollections}</a>
     {catalog.products.length>0&&<a href="#panier" className={styles.navCart}>{t.navCart}</a>}
     <LanguageSwitch lang={lang} label={t.switchTo} ariaLabel={t.switchLabel}
      href={storefrontLangHref(publicBase,lang==='ar'?'fr':'ar')}/>
    </nav>
   </header>
   <section className={styles.hero} aria-labelledby="storefront-title">
    <div className={styles.heroCopy}>
     <span className={styles.kicker}>{t.heroKicker}</span>
     <h1 id="storefront-title">{shopName}</h1>
     <p className={styles.heroDescription} dir="auto">{catalog.description||t.heroFallback}</p>
     <div className={styles.heroActions}>
      <a href="#catalogue" className={styles.primaryAction}>{t.discover} <span aria-hidden="true">↗</span></a>
      {catalog.products.length>0&&<a href="#panier" className={styles.secondaryAction}>{t.orderOnline}</a>}
     </div>
     {names.length>0&&<div className={styles.heroCategories} aria-label={t.categoriesLabel}>
      {names.map(name=><span key={name}>{name}</span>)}
     </div>}
    </div>
    <div className={styles.heroVisual}>
     {catalog.bannerUrl?<img src={catalog.bannerUrl}
      alt={t.bannerAlt(shopName)} loading="eager" decoding="async"
      referrerPolicy="no-referrer" className={styles.heroImage}/>:
      heroProduct?.imageUrl?<img src={heroProduct.imageUrl}
       alt={t.featuredAlt(heroProduct.name)} loading="eager" decoding="async"
       referrerPolicy="no-referrer" className={styles.heroImage}/>:
       <div className={styles.heroAbstract} aria-hidden="true"><span>✦</span><span>TC</span></div>}
     {heroProduct&&<div className={styles.featuredBadge}>
      <span>{t.featured}</span>
      <strong dir="auto">{heroProduct.name}</strong>
      <small>{formatStorefrontMoney(heroProduct.price,lang)}</small>
     </div>}
    </div>
   </section>
   <section className={styles.pillars} aria-label={t.orderInfo}>
    <div><span aria-hidden="true">✧</span><strong>{t.pillarChoice}</strong><small>{t.pillarChoiceText}</small></div>
    <div><span aria-hidden="true">◈</span><strong>{t.pillarCod}</strong><small>{t.pillarCodText}</small></div>
    <div><span aria-hidden="true">✦</span><strong>{t.pillarTracked}</strong><small>{t.pillarTrackedText}</small></div>
   </section>
   <CatalogBrowser slug={slug} products={catalog.products} lang={lang}/>
   {catalog.products.length>0&&<PublicCart slug={slug} initialProductId={productToAdd}
    shipping={catalog.shipping} zones={catalog.zones} lang={lang}
    products={catalog.products.map(product=>({id:product.id,name:product.name,
     variant:product.variant,price:product.price,available:product.available,offers:product.offers}))}
    theme={theme}/>}
   {whatsappHref&&<a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={styles.whatsappFloat} aria-label={t.whatsappLabel}>
    <span aria-hidden="true">💬</span><b>WhatsApp</b></a>}
   {catalog.products.length===0&&<div className={styles.emptyState}>
    <h2>{t.soon}</h2>
    <p>{t.soonText}</p>
   </div>}
   <footer className={styles.footer}>
    <div><strong>{shopName}</strong><p>{t.footerTagline}</p></div>
    <div>{catalog.phone&&<span>{t.merchantContact(catalog.phone)}</span>}
     <span>{t.footerConditions}</span></div>
   </footer>
  </div>
 </main>;
}
