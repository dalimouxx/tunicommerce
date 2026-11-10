import Link from 'next/link';
import type {Metadata} from 'next';
import type {CSSProperties} from 'react';
import {notFound} from 'next/navigation';
import {cookies} from 'next/headers';
import {prisma} from '../../../../../modules/storage/client';
import {isPublicIsolatedShop} from '../../../../../modules/shops/publication';
import {normalizeState} from '../../../../../modules/commerce/normalize';
import type {State} from '../../../../../modules/commerce/types';
import {publicProductDetail} from '../../../../../modules/shops/public-product-detail';
import {fastestDeliveryDays} from '../../../../../modules/shops/product-cod-form';
import ProductCodForm from './product-cod-form';
import StorefrontPixels from '../../storefront-pixels';
import {productWhatsappMessage,whatsappLink} from '../../../../../modules/shops/storefront-marketing';
import LanguageSwitch from '../../language-switch';
import {arabicFont} from '../../arabic-font';
import {STOREFRONT_LANG_COOKIE,formatStorefrontMoney,resolveStorefrontLang,storefrontDictionary,storefrontDir,storefrontLangHref} from '../../../../../modules/shops/storefront-i18n';
import styles from '../../storefront-premium.module.css';

export const dynamic='force-dynamic';
type Context={params:Promise<{slug:string;productId:string}>};
async function productForPublishedStore(slug:string,productId:string){
 if(!slug||slug.length>180||!productId||productId.length>160)return null;
 const shop=await prisma.shop.findUnique({where:{slug},select:{
  status:true,legacyWorkspaceId:true,
  commerce:{select:{data:true}},
  organization:{select:{owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}}
 }});
 const subscription=shop?.organization.owner.workspace;
 if(!shop||!isPublicIsolatedShop({
  status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,
  initialized:!!shop.commerce,subscriptionStatus:subscription?.subscriptionStatus||'',
  subscriptionEndsAt:subscription?.subscriptionEndsAt||null
 }))return null;
 return publicProductDetail(normalizeState(shop.commerce!.data as unknown as State),productId);
}
export async function generateMetadata({params}:Context):Promise<Metadata>{
 const {slug,productId}=await params;
 const detail=await productForPublishedStore(slug,productId);
 if(!detail)return {title:'Produit indisponible',robots:{index:false,follow:false}};
 const title=(detail.product.name+' | '+detail.store.name).slice(0,150);
 const description=(detail.product.description||detail.product.name+' · commande COD en Tunisie').slice(0,160);
 return {title,description,robots:{index:detail.product.available,follow:true},
  openGraph:{title,description,type:'website'}};
}
export default async function PublicProductPage({params,searchParams}:Context&{searchParams:Promise<{lang?:string}>}){
 const {slug,productId}=await params;
 const query=await searchParams;
 const detail=await productForPublishedStore(slug,productId);
 if(!detail)notFound();
 const {product,store,similar}=detail,theme=store.theme;
 const base='/vitrines/'+encodeURIComponent(slug);
 const marketing=store.marketing;
 const lang=resolveStorefrontLang(query.lang,(await cookies()).get(STOREFRONT_LANG_COOKIE)?.value,marketing.language);
 const catalogHref=storefrontLangHref(base,lang);
 const collectionHref=storefrontLangHref(base+'#catalogue',lang);
 const t=storefrontDictionary(lang);
 const productPath=base+'/produit/'+encodeURIComponent(product.id);
 const whatsappHref=whatsappLink(marketing.whatsapp,productWhatsappMessage(marketing,product.name,undefined,t.whatsappProductIntro));
 const vars={'--store-bg':theme.background,'--store-text':theme.foreground,
  '--store-accent':theme.accent,'--store-accent-text':theme.accentText,
  '--store-surface':theme.surface,'--store-muted':theme.muted} as CSSProperties;
 return <main className={styles.page+' '+arabicFont.variable} data-theme={theme.code} style={vars} lang={lang} dir={storefrontDir(lang)}>
  <StorefrontPixels metaPixelId={marketing.metaPixelId} tiktokPixelId={marketing.tiktokPixelId}/>
  <div className={styles.announcement}>{t.announcementProduct}</div>
  <div className={styles.container}>
   <header className={styles.storeHeader}>
    <Link className={styles.identity} href={catalogHref}><span className={styles.fallbackLogo}>{store.name.slice(0,1)}</span>
     <span className={styles.brandText}><strong>{store.name}</strong><small>{t.backToCatalog}</small></span></Link>
    <nav className={styles.nav} aria-label={t.productNav}><Link href={catalogHref}>{t.navAllProducts}</Link>
     <LanguageSwitch lang={lang} label={t.switchTo} ariaLabel={t.switchLabel}
      href={storefrontLangHref(productPath,lang==='ar'?'fr':'ar')}/></nav>
   </header>
   <nav className={styles.breadcrumb} aria-label={t.breadcrumb}>
    <Link href={catalogHref}>{t.breadcrumbHome}</Link><span aria-hidden="true">/</span>
    <Link href={collectionHref}>{product.category||t.collection}</Link><span aria-hidden="true">/</span>
    <bdi aria-current="page">{product.name}</bdi>
   </nav>
   <article className={styles.detailLayout}>
    <div className={styles.detailMedia}>
     {product.imageUrl?<img src={product.imageUrl} alt={t.photoOf(product.name)}
      loading="eager" decoding="async" referrerPolicy="no-referrer"/>:
      <div className={styles.productPlaceholder} aria-hidden="true">✧</div>}
    </div>
    <div className={styles.detailCopy}>
     <p className={styles.kicker} dir="auto">{product.category||t.ourSelection}</p>
     <h1 dir="auto">{product.name}</h1>
     {product.variant&&<p className={styles.variant}>{t.variant(product.variant)}</p>}
     <p className={styles.detailPrice}>{formatStorefrontMoney(product.price,lang)}</p>
     <p className={styles.detailAvailability} aria-live="polite">{product.available?t.inStock:'● '+t.outOfStock}</p>
     {product.available?<ProductCodForm slug={slug} productId={product.id} productName={product.name}
      unitPrice={product.price} zones={store.zones} defaultShipping={store.shipping}
      deliveryDays={fastestDeliveryDays(store.zones)} whatsapp={marketing.whatsapp} lang={lang} offers={product.offers}/>:
      <div className={styles.codUnavailable}>
       <strong>{t.unavailableTitle}</strong>
       <p>{t.unavailableText}</p>
       <Link href={collectionHref} className={styles.secondaryAction}>{t.seeCatalog}</Link>
      </div>}
     {product.description&&<section className={styles.detailDescriptionBlock} aria-labelledby="product-description">
      <h2 id="product-description">{t.description}</h2>
      <p className={styles.detailDescription} dir="auto">{product.description}</p>
     </section>}
     {whatsappHref&&<a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={styles.whatsappInline}>
      <span aria-hidden="true">💬</span> {t.whatsappQuestion}</a>}
     <Link href={collectionHref} className={styles.codLink}>{t.continueShopping}</Link>
    </div>
   </article>
   {similar.length>0&&<section className={styles.similar} aria-labelledby="similar-title">
    <div className={styles.sectionHeading}><div><p className={styles.kicker}>{t.similarKicker}</p>
     <h2 id="similar-title">{t.similarTitle}</h2></div></div>
    <div className={styles.similarList}>{similar.map(item=><Link key={item.id}
     href={storefrontLangHref(base+'/produit/'+encodeURIComponent(item.id),lang)}>
     <strong dir="auto">{item.name}</strong><span>{formatStorefrontMoney(item.price,lang)}</span>
    </Link>)}</div>
   </section>}
   {whatsappHref&&<a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={styles.whatsappFloat+' '+styles.whatsappFloatRaised} aria-label={t.whatsappLabel}>
    <span aria-hidden="true">💬</span><b>WhatsApp</b></a>}
   <footer className={styles.footer}><strong>{store.name}</strong>
    <p>{t.footerProduct}</p></footer>
  </div>
 </main>;
}
