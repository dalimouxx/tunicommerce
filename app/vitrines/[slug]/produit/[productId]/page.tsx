import Link from 'next/link';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {prisma} from '../../../../../modules/storage/client';
import {isPublicIsolatedShop} from '../../../../../modules/shops/publication';
import {normalizeState} from '../../../../../modules/commerce/normalize';
import {money,type State} from '../../../../../modules/commerce/types';
import {publicProductDetail} from '../../../../../modules/shops/public-product-detail';

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
 return <main style={{background:theme.background,color:theme.foreground,minHeight:'100vh',padding:'28px 18px',fontFamily:'Arial,sans-serif'}}>
  <div style={{maxWidth:1020,margin:'0 auto'}}>
   <nav><Link href={'/vitrines/'+encodeURIComponent(slug)} style={{color:theme.accent}}>Retour à {store.name}</Link></nav>
   <article style={{marginTop:20,background:theme.surface,border:'1px solid '+theme.accent,borderRadius:18,padding:26}}>
    <p style={{color:theme.accent}}>{product.category}</p>
    {product.imageUrl&&<img src={product.imageUrl} alt={'Photo de '+product.name}
     loading="eager" decoding="async" referrerPolicy="no-referrer"
     style={{width:'100%',maxWidth:480,maxHeight:390,objectFit:'contain',display:'block',
      borderRadius:14,background:'#f8fafc',marginBottom:16}}/>}
    <h1>{product.name}</h1>
    {product.variant&&<p>Variante : {product.variant}</p>}
    {product.description&&<p>{product.description}</p>}
    <h2>{money(product.price)} TND</h2>
    <p>{product.available?'En stock · Disponible à la commande':'Rupture de stock · Commande indisponible'}</p>
    <p>Le prix de livraison et toute réduction sont confirmés lors du checkout. Paiement à la livraison uniquement.</p>
    {product.available&&<Link href={'/vitrines/'+encodeURIComponent(slug)+'?produit='+encodeURIComponent(product.id)+'#panier'}
     style={{display:'inline-block',marginTop:12,padding:'12px 18px',background:theme.accent,
      color:theme.code==='MINUIT'?'#112331':'#fff',borderRadius:10,textDecoration:'none',fontWeight:700}}>
     Ajouter au panier et commander</Link>}
   </article>
   {similar.length>0&&<section style={{marginTop:25}}>
    <h2>Autres produits dans cette catégorie</h2>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{similar.map(item=><Link key={item.id}
     href={'/vitrines/'+encodeURIComponent(slug)+'/produit/'+encodeURIComponent(item.id)}
     style={{background:theme.surface,color:theme.foreground,padding:14,borderRadius:10,border:'1px solid '+theme.accent}}>
      {item.name} · {money(item.price)} TND</Link>)}</div>
   </section>}
  </div>
 </main>;
}
