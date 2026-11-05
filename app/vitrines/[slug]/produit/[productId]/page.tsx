import Link from 'next/link';
import type {Metadata} from 'next';
import type {CSSProperties} from 'react';
import {notFound} from 'next/navigation';
import {prisma} from '../../../../../modules/storage/client';
import {isPublicIsolatedShop} from '../../../../../modules/shops/publication';
import {normalizeState} from '../../../../../modules/commerce/normalize';
import {money,type State} from '../../../../../modules/commerce/types';
import {publicProductDetail} from '../../../../../modules/shops/public-product-detail';
import {fastestDeliveryDays} from '../../../../../modules/shops/product-cod-form';
import ProductCodForm from './product-cod-form';
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
export default async function PublicProductPage({params}:Context){
 const {slug,productId}=await params;
 const detail=await productForPublishedStore(slug,productId);
 if(!detail)notFound();
 const {product,store,similar}=detail,theme=store.theme;
 const base='/vitrines/'+encodeURIComponent(slug);
 const vars={'--store-bg':theme.background,'--store-text':theme.foreground,
  '--store-accent':theme.accent,'--store-accent-text':theme.accentText,
  '--store-surface':theme.surface,'--store-muted':theme.muted} as CSSProperties;
 return <main className={styles.page} data-theme={theme.code} style={vars}>
  <div className={styles.announcement}>Une boutique tunisienne indépendante · Paiement à la livraison</div>
  <div className={styles.container}>
   <header className={styles.storeHeader}>
    <Link className={styles.identity} href={base}><span className={styles.fallbackLogo}>{store.name.slice(0,1)}</span>
     <span className={styles.brandText}><strong>{store.name}</strong><small>Retour à notre catalogue</small></span></Link>
    <nav className={styles.nav} aria-label="Navigation produit"><Link href={base}>Tous les produits</Link></nav>
   </header>
   <nav className={styles.breadcrumb} aria-label="Fil d’Ariane">
    <Link href={base}>Accueil boutique</Link><span aria-hidden="true">/</span>
    <Link href={base+'#catalogue'}>{product.category||'Collection'}</Link><span aria-hidden="true">/</span>
    <span aria-current="page">{product.name}</span>
   </nav>
   <article className={styles.detailLayout}>
    <div className={styles.detailMedia}>
     {product.imageUrl?<img src={product.imageUrl} alt={'Photo de '+product.name}
      loading="eager" decoding="async" referrerPolicy="no-referrer"/>:
      <div className={styles.productPlaceholder} aria-hidden="true">✧</div>}
    </div>
    <div className={styles.detailCopy}>
     <p className={styles.kicker}>{product.category||'Notre sélection'}</p>
     <h1>{product.name}</h1>
     {product.variant&&<p className={styles.variant}>Variante : {product.variant}</p>}
     <p className={styles.detailPrice}>{money(product.price)} TND</p>
     <p className={styles.detailAvailability} aria-live="polite">{product.available?'● En stock · commande sans compte':'● Rupture de stock'}</p>
     {product.available?<ProductCodForm slug={slug} productId={product.id} productName={product.name}
      unitPrice={product.price} zones={store.zones} defaultShipping={store.shipping}
      deliveryDays={fastestDeliveryDays(store.zones)}/>:
      <div className={styles.codUnavailable}>
       <strong>Ce produit est momentanément indisponible.</strong>
       <p>Découvrez les autres articles de la boutique.</p>
       <Link href={base+'#catalogue'} className={styles.secondaryAction}>Voir le catalogue</Link>
      </div>}
     {product.description&&<section className={styles.detailDescriptionBlock} aria-labelledby="product-description">
      <h2 id="product-description">Description</h2>
      <p className={styles.detailDescription}>{product.description}</p>
     </section>}
     <Link href={base+'#catalogue'} className={styles.codLink}>← Continuer mes achats</Link>
    </div>
   </article>
   {similar.length>0&&<section className={styles.similar} aria-labelledby="similar-title">
    <div className={styles.sectionHeading}><div><p className={styles.kicker}>À DÉCOUVRIR AUSSI</p>
     <h2 id="similar-title">La même collection</h2></div></div>
    <div className={styles.similarList}>{similar.map(item=><Link key={item.id}
     href={base+'/produit/'+encodeURIComponent(item.id)}>
     <strong>{item.name}</strong><span>{money(item.price)} TND</span>
    </Link>)}</div>
   </section>}
   <footer className={styles.footer}><strong>{store.name}</strong>
    <p>Les informations de stock et de livraison sont vérifiées lors de la commande.</p></footer>
  </div>
 </main>;
}
