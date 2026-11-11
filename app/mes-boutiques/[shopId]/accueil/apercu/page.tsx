import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../../modules/auth/session';
import {getShopHome,homeOwner} from '../../../../../modules/shops/home-service';
import {prisma} from '../../../../../modules/storage/client';
import {normalizeState} from '../../../../../modules/commerce/normalize';
import type {State} from '../../../../../modules/commerce/types';
import {publicCatalog} from '../../../../../modules/platform/public';
import {readPresentation} from '../../../../../modules/appearance/validation';
import StorefrontTheme from '../../../../../components/storefront-theme';
import ShopHomeSections from '../../../../../components/shop-home-sections';
import IsolatedPreview from '../../apercu/page';
import styles from '../../../../../components/shop-home.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Aperçu privé de mon accueil · Tunicom',robots:{index:false,follow:false}};
export default async function HomePreview({params,searchParams}:{params:Promise<{shopId:string}>;searchParams:Promise<{lang?:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');const {shopId}=await params;
 const shop=await homeOwner(actor.userId,shopId).catch(()=>null);if(!shop)notFound();
 const lang=(await searchParams).lang==='ar'?'ar':'fr';
 if(!shop.legacyWorkspaceId)return <IsolatedPreview params={Promise.resolve({shopId})} searchParams={Promise.resolve({lang})}/>;
 const workspace=await prisma.workspace.findUnique({where:{id:shop.legacyWorkspaceId},select:{data:true}});if(!workspace)notFound();
 const state=normalizeState(workspace.data as unknown as State),catalog=publicCatalog(state),home=(await getShopHome(actor.userId,shopId)).draft;
 return <StorefrontTheme appearance={readPresentation(state)} announcement={home[lang].announcement}>
  <main className="platform"><aside className={styles.note}>APERÇU PRIVÉ · Brouillon enregistré. Les commandes sont désactivées ici. <Link href={'/mes-boutiques/'+shopId+'/accueil'}>Retour à l’éditeur</Link></aside>
   {catalog.bannerUrl&&<img className="shop-banner" src={catalog.bannerUrl} alt="" referrerPolicy="no-referrer"/>}
   <section className="platform-hero" lang={lang} dir={lang==='ar'?'rtl':'ltr'}>{catalog.logoUrl&&<img className="shop-logo" src={catalog.logoUrl} alt={catalog.name} referrerPolicy="no-referrer"/>}<h1 dir="auto">{home[lang].heroTitle||catalog.name}</h1><p dir="auto">{home[lang].heroDescription||catalog.description||'Choisissez vos produits. Nous vous contactons pour confirmer votre commande.'}</p></section>
   {home.sectionsPosition==='beforeCatalog'&&<div className={styles.legacy}><ShopHomeSections content={home} lang={lang} preview/></div>}
   <section id="catalogue"><h2>Catalogue · aperçu sans commande</h2><div className="public-grid">{catalog.products.map(product=><article className="card product-tile" key={product.id}>{product.imageUrl&&<img className="public-product-image" src={product.imageUrl} alt={product.name} loading="lazy" referrerPolicy="no-referrer"/>}<h3>{product.name}</h3><p>{product.variant}</p><button disabled>Commander · aperçu uniquement</button></article>)}</div></section>
   {home.sectionsPosition==='afterCatalog'&&<div className={styles.legacy}><ShopHomeSections content={home} lang={lang} preview/></div>}
  </main>
 </StorefrontTheme>;
}
