import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../modules/shops/isolated-commerce';
import {isolatedStorefrontPreview} from '../../../../modules/shops/storefront-preview';
import {money} from '../../../../modules/commerce/types';
import styles from '../../shops.module.css';

export const dynamic='force-dynamic';

export default async function ShopStorefrontPreview({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();
 if(!actor)redirect('/login');
 const {shopId}=await params;
 const shop=await requireIsolatedOwner(actor.userId,shopId).catch(()=>null);
 if(!shop)notFound();
 const commerce=await readIsolatedCommerce(shopId,shop.name);
 if(!commerce.initialized)notFound();
 const catalog=isolatedStorefrontPreview(commerce.state);
 return <main className={styles.shell}>
  <div className={styles.content}>
   <header className={styles.header}>
    <div><span className={styles.eyebrow}>APERÇU PRIVÉ · AUCUNE VENTE PUBLIQUE</span>
     <h1>{catalog.name}</h1>
     <p>Voici ce que pourrait voir un acheteur. Cette page est réservée au propriétaire de la boutique et ne permet pas encore de commander.</p>
    </div>
    <Link className={styles.back} href={'/mes-boutiques/'+encodeURIComponent(shopId)}>Retour à la gestion</Link>
   </header>
   <section className={styles.card}>
    <h2>Vitrine de {catalog.name}</h2>
    <p>{catalog.description||'Découvrez les articles disponibles dans notre boutique.'}</p>
    <p>Les prix sont indiqués en dinars tunisiens (TND). Publication, paiement et checkout indépendants seront activés après validation des règles d'abonnement et de visibilité.</p>
   </section>
   <div className={styles.grid}>
    {catalog.products.map(product=><article key={product.id} className={styles.card}>
     {product.imageUrl&&<img src={product.imageUrl} alt={product.name} loading="lazy" style={{width:'100%',height:200,objectFit:'contain',borderRadius:12}}/>}
     <span className={styles.kicker}>{product.category}</span>
     <h2>{product.name}</h2>
     {product.variant&&<p>Variante : {product.variant}</p>}
     {product.description&&<p>{product.description}</p>}
     <p><strong>{money(product.price)} TND</strong></p>
     <p>{product.available?'Disponible':'Rupture de stock'}</p>
     <button type="button" disabled style={{padding:'10px 14px'}}>Commande bientôt disponible</button>
    </article>)}
   </div>
   {catalog.products.length===0&&<section className={styles.card}>
    <h2>Votre catalogue est vide</h2><p>Ajoutez des produits depuis la gestion de votre boutique pour les voir ici.</p>
   </section>}
  </div>
 </main>;
}
