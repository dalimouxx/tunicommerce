'use client';
import Link from 'next/link';
import {useState} from 'react';
import {catalogCategories,selectCatalogProducts,type CatalogProduct,type CatalogSort} from '../../../modules/shops/public-catalog-filters';
import {formatStorefrontMoney,storefrontDictionary,storefrontLangHref,type StorefrontLang} from '../../../modules/shops/storefront-i18n';
import styles from './storefront-premium.module.css';
export default function CatalogBrowser({slug,products,lang='fr'}:{slug:string;products:CatalogProduct[];lang?:StorefrontLang}){
 const t=storefrontDictionary(lang);
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
   <div><p className={styles.kicker}>{t.catalogKicker}</p><h2 id="catalogue-titre">{t.catalogTitle}</h2></div>
   <p>{t.catalogIntro}</p>
  </div>
  {categories.length>0&&<div role="group" aria-label={t.collections} className={styles.categoryChips}>
   <button type="button" aria-pressed={!category} data-active={!category}
    onClick={()=>updateCategory('')}>{t.allCollections}</button>
   {categories.map(value=><button key={value} type="button" aria-pressed={category===value}
    data-active={category===value} onClick={()=>updateCategory(value)}>{value}</button>)}
  </div>}
  <div className={styles.filters}>
   <label className={styles.searchInput}>{t.searchLabel}
    <input type="search" aria-label={t.searchAria} placeholder={t.searchPlaceholder}
     value={search} onChange={e=>{setSearch(e.target.value);setVisibleCount(24);}}/>
   </label>
   <label>{t.categoryLabel}
    <select aria-label={t.categoryAria} value={category}
     onChange={e=>updateCategory(e.target.value)}>
     <option value="">{t.all}</option>
     {categories.map(value=><option value={value} key={value}>{value}</option>)}
    </select>
   </label>
   <label>{t.sortLabel}
    <select aria-label={t.sortAria} value={sort}
     onChange={e=>{setSort(e.target.value as CatalogSort);setVisibleCount(24);}}>
     <option value="featured">{t.sortFeatured}</option>
     <option value="price-asc">{t.sortPriceAsc}</option>
     <option value="price-desc">{t.sortPriceDesc}</option>
     <option value="name">{t.sortName}</option>
    </select>
   </label>
   <label className={styles.availableToggle}>
    <input type="checkbox" checked={availableOnly}
     onChange={e=>{setAvailableOnly(e.target.checked);setVisibleCount(24);}}/>
    {t.inStockOnly}
   </label>
  </div>
  <p className={styles.catalogCount} aria-live="polite">{t.count(matching.length,shown.length)}</p>
  <div className={styles.productGrid}>
   {shown.map(product=><article key={product.id} className={styles.productCard}>
    <Link className={styles.productImageWrap} href={storefrontLangHref(shopPath+'/produit/'+encodeURIComponent(product.id),lang)}
     aria-label={t.view(product.name)}>
     {product.imageUrl?<img src={product.imageUrl} alt={t.photoOf(product.name)}
      loading="lazy" decoding="async" referrerPolicy="no-referrer"/>:
      <span className={styles.productPlaceholder} aria-hidden="true">✧</span>}
     {!product.available&&<span className={styles.outOfStock}>{t.outOfStock}</span>}
    </Link>
    <div className={styles.productBody}>
     <span className={styles.productCategory}>{product.category||t.collection}</span>
     <h3 dir="auto"><Link href={storefrontLangHref(shopPath+'/produit/'+encodeURIComponent(product.id),lang)}>{product.name}</Link></h3>
     {product.variant&&<p className={styles.variant}>{product.variant}</p>}
     {product.description&&<p className={styles.description} dir="auto">{product.description}</p>}
     <p className={styles.productPrice}>{formatStorefrontMoney(product.price,lang)}</p>
     <div className={styles.productButtons}>
      {product.available&&<Link className={styles.productBuy} href={
       storefrontLangHref(shopPath+'?produit='+encodeURIComponent(product.id)+'#panier',lang)
      }>{t.addToCart}</Link>}
      <Link className={styles.productDetail} href={storefrontLangHref(shopPath+'/produit/'+encodeURIComponent(product.id),lang)}>
       {t.details} <span aria-hidden="true">↗</span>
      </Link>
     </div>
    </div>
   </article>)}
  </div>
  {matching.length===0&&<div className={styles.emptyState} role="status">
   <h3>{t.noProduct}</h3><p>{t.noProductText}</p>
  </div>}
  {matching.length>visibleCount&&<button type="button" className={styles.moreButton}
   onClick={()=>setVisibleCount(n=>n+24)}>
   {t.showMore(Math.min(24,matching.length-visibleCount))}
  </button>}
 </section>;
}
