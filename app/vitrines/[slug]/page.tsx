import {notFound} from 'next/navigation';
import Link from 'next/link';
import type {Metadata} from 'next';
import PublicCart from './public-cart';
import CatalogBrowser from './catalog-browser';
import {prisma} from '../../../modules/storage/client';
import {isPublicIsolatedShop} from '../../../modules/shops/publication';
import {isolatedStorefrontPreview} from '../../../modules/shops/storefront-preview';
import {normalizeState} from '../../../modules/commerce/normalize';
import type {State} from '../../../modules/commerce/types';
import styles from '../../mes-boutiques/shops.module.css';

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
 return <main className={styles.shell} style={{background:theme.background,color:theme.foreground}}>
  <div className={styles.content}>
   <header className={styles.header}><div>
    <span className={styles.eyebrow} style={{color:theme.accent}}>BOUTIQUE PUBLIQUE · CATALOGUE</span>
    {catalog.logoUrl&&<img src={catalog.logoUrl} alt={'Logo '+(catalog.name||shop.name)} loading="lazy" referrerPolicy="no-referrer" style={{width:76,height:76,objectFit:'contain',borderRadius:16,background:theme.surface,padding:8}}/>}
    <h1>{catalog.name||shop.name}</h1>
    <p>{catalog.description||'Découvrez nos produits.'}</p>
    {catalog.phone&&<p>Contact marchand : {catalog.phone}</p>}
   </div></header>
   {catalog.bannerUrl&&<div style={{overflow:'hidden',borderRadius:16,marginBottom:18}}><img src={catalog.bannerUrl} alt={'Bannière de '+(catalog.name||shop.name)} loading="lazy" referrerPolicy="no-referrer" style={{width:'100%',maxHeight:320,objectFit:'cover',display:'block'}}/></div>}
   <section className={styles.card} style={{background:theme.surface,color:theme.foreground,borderColor:theme.accent}}>
    <h2>Catalogue</h2>
    <p>Prix en dinars tunisiens. Commande avec paiement à la livraison uniquement. Le marchand confirmera la commande avant préparation.</p>
   </section>
   <CatalogBrowser slug={slug} products={catalog.products} surface={theme.surface}
    foreground={theme.foreground} accent={theme.accent}/>
   {catalog.products.length>0&&<PublicCart slug={slug} initialProductId={productToAdd} shipping={catalog.shipping} zones={catalog.zones} products={catalog.products.map(p=>({id:p.id,name:p.name,variant:p.variant,price:p.price,available:p.available}))}/>}
   {catalog.products.length===0&&<section className={styles.card} style={{background:theme.surface,color:theme.foreground}}><p>Aucun produit disponible pour le moment.</p></section>}
  </div>
 </main>;
}
