'use client';
import Link from 'next/link';
import {useState} from 'react';
import {catalogCategories,selectCatalogProducts,type CatalogProduct,type CatalogSort} from '../../../modules/shops/public-catalog-filters';
import styles from './storefront-premium.module.css';
const money=(millimes:number)=>(millimes/1000).toFixed(3);
export default function CatalogBrowser({slug,products}:{slug:string;products:CatalogProduct[]}){
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState('');
 const [availableOnly,setAvailableOnly]=useState(false);
 const [sort,setSort]=useState<CatalogSort>('featured');
 const [visibleCount,setVisibleCount]=useState(24);
 const categories=catalogCategories(products);
 const matching=selectCatalogProducts(products,{search,category,availableOnly,sort});
 const shown=matching.slice(0,visibleCount);
 const shopPath='/vitrines/'+encodeURIComponent(slug);
 const updateCategory=(value:string)=>{setCategory(value);setVisibleCount(24);};
 return <section id="catalogue" aria-labelledby="catalogue-titre" className={styles.catalogue}>
  <div className={styles.sectionHeading}>
   <div><p className={styles.kicker}>NOTRE SÉLECTION</p><h2 id="catalogue-titre">Explorer la collection</h2></div>
   <p>Des articles sélectionnés, commandables en quelques étapes.</p>
  </div>
  {categories.length>0&&<div role="group" aria-label="Collections" className={styles.categoryChips}>
   <button type="button" aria-pressed={!category} data-active={!category}
    onClick={()=>updateCategory('')}>Toutes les collections</button>
   {categories.map(value=><button key={value} type="button" aria-pressed={category===value}
    data-active={category===value} onClick={()=>updateCategory(value)}>{value}</button>)}
  </div>}
  <div className={styles.filters}>
   <label className={styles.searchInput}>Rechercher un produit
    <input type="search" aria-label="Rechercher dans le catalogue" placeholder="Nom, variante, catégorie…"
     value={search} onChange={e=>{setSearch(e.target.value);setVisibleCount(24);}}/>
   </label>
   <label>Catégorie
    <select aria-label="Filtrer les catégories" value={category}
     onChange={e=>updateCategory(e.target.value)}>
     <option value="">Toutes</option>
     {categories.map(value=><option value={value} key={value}>{value}</option>)}
    </select>
   </label>
   <label>Trier
    <select aria-label="Trier les produits" value={sort}
     onChange={e=>{setSort(e.target.value as CatalogSort);setVisibleCount(24);}}>
     <option value="featured">Notre sélection</option>
     <option value="price-asc">Prix croissant</option>
     <option value="price-desc">Prix décroissant</option>
     <option value="name">Nom A–Z</option>
    </select>
   </label>
   <label className={styles.availableToggle}>
    <input type="checkbox" checked={availableOnly}
     onChange={e=>{setAvailableOnly(e.target.checked);setVisibleCount(24);}}/>
    En stock uniquement
   </label>
  </div>
  <p className={styles.catalogCount} aria-live="polite">{matching.length} article(s) · {shown.length} affiché(s)</p>
  <div className={styles.productGrid}>
   {shown.map(product=><article key={product.id} className={styles.productCard}>
    <Link className={styles.productImageWrap} href={shopPath+'/produit/'+encodeURIComponent(product.id)}
     aria-label={'Voir '+product.name}>
     {product.imageUrl?<img src={product.imageUrl} alt={'Photo de '+product.name}
      loading="lazy" decoding="async" referrerPolicy="no-referrer"/>:
      <span className={styles.productPlaceholder} aria-hidden="true">✧</span>}
     {!product.available&&<span className={styles.outOfStock}>Rupture de stock</span>}
    </Link>
    <div className={styles.productBody}>
     <span className={styles.productCategory}>{product.category||'Collection'}</span>
     <h3><Link href={shopPath+'/produit/'+encodeURIComponent(product.id)}>{product.name}</Link></h3>
     {product.variant&&<p className={styles.variant}>{product.variant}</p>}
     {product.description&&<p className={styles.description}>{product.description}</p>}
     <p className={styles.productPrice}>{money(product.price)} <small>TND</small></p>
     <div className={styles.productButtons}>
      {product.available&&<Link className={styles.productBuy} href={
       shopPath+'?produit='+encodeURIComponent(product.id)+'#panier'
      }>Ajouter au panier</Link>}
      <Link className={styles.productDetail} href={shopPath+'/produit/'+encodeURIComponent(product.id)}>
       Détails <span aria-hidden="true">↗</span>
      </Link>
     </div>
    </div>
   </article>)}
  </div>
  {matching.length===0&&<div className={styles.emptyState} role="status">
   <h3>Aucun produit trouvé</h3><p>Essayez une autre catégorie ou un autre terme.</p>
  </div>}
  {matching.length>visibleCount&&<button type="button" className={styles.moreButton}
   onClick={()=>setVisibleCount(n=>n+24)}>
   Voir {Math.min(24,matching.length-visibleCount)} produit(s) de plus
  </button>}
 </section>;
}
