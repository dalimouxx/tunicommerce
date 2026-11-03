import {notFound} from 'next/navigation';
import {prisma} from '../../../modules/storage/client';
import {isPublicIsolatedShop} from '../../../modules/shops/publication';
import {isolatedStorefrontPreview} from '../../../modules/shops/storefront-preview';
import {normalizeState} from '../../../modules/commerce/normalize';
import {money,type State} from '../../../modules/commerce/types';
import styles from '../../mes-boutiques/shops.module.css';

export const dynamic='force-dynamic';

export default async function IsolatedPublicStorefront({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
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
 return <main className={styles.shell}>
  <div className={styles.content}>
   <header className={styles.header}><div>
    <span className={styles.eyebrow}>BOUTIQUE PUBLIQUE · CATALOGUE</span>
    <h1>{catalog.name||shop.name}</h1>
    <p>{catalog.description||'Découvrez nos produits.'}</p>
   </div></header>
   <section className={styles.card}>
    <h2>Catalogue</h2>
    <p>Prix en dinars tunisiens. Les commandes en ligne ne sont pas encore disponibles pour cette boutique ; aucun paiement ni réservation n'est effectué.</p>
   </section>
   <div className={styles.grid}>
    {catalog.products.map(product=><article key={product.id} className={styles.card}>
     <span className={styles.kicker}>{product.category}</span>
     <h2>{product.name}</h2>
     {product.variant&&<p>{product.variant}</p>}
     {product.description&&<p>{product.description}</p>}
     <p><strong>{money(product.price)} TND</strong></p>
     <p>{product.available?'Disponible':'Rupture de stock'}</p>
     <button disabled type="button">Commande bientôt disponible</button>
    </article>)}
   </div>
   {catalog.products.length===0&&<section className={styles.card}><p>Aucun produit disponible pour le moment.</p></section>}
  </div>
 </main>;
}
