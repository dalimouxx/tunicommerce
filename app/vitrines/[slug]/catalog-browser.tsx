'use client';
import Link from 'next/link';
import {useState} from 'react';
import {catalogCategories,selectCatalogProducts,type CatalogProduct,type CatalogSort} from '../../../modules/shops/public-catalog-filters';

const money=(millimes:number)=>(millimes/1000).toFixed(3);
export default function CatalogBrowser({slug,products,surface,foreground,accent}:{
 slug:string;products:CatalogProduct[];surface:string;foreground:string;accent:string
}){
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState('');
 const [availableOnly,setAvailableOnly]=useState(false);
 const [sort,setSort]=useState<CatalogSort>('featured');
 const [visibleCount,setVisibleCount]=useState(24);
 const categories=catalogCategories(products);
 const matching=selectCatalogProducts(products,{search,category,availableOnly,sort});
 const shown=matching.slice(0,visibleCount);
 const shopPath='/vitrines/'+encodeURIComponent(slug);
 return <section aria-labelledby="catalogue-titre">
  <h2 id="catalogue-titre" style={{margin:'18px 0 10px'}}>Découvrir les produits</h2>
  <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end',padding:'15px 0 20px'}}>
   <label style={{flex:'1 1 210px',maxWidth:370}}>Rechercher un article
    <input type="search" aria-label="Rechercher dans le catalogue" placeholder="Nom, variante, catégorie…" value={search}
     onChange={e=>{setSearch(e.target.value);setVisibleCount(24);}}
     style={{display:'block',width:'100%',padding:12,border:'1px solid #bacbd4',borderRadius:9}}/>
   </label>
   <label>Catégorie
    <select aria-label="Filtrer les catégories" value={category} onChange={e=>{setCategory(e.target.value);setVisibleCount(24);}}
     style={{display:'block',minWidth:160,padding:12,border:'1px solid #bacbd4',borderRadius:9}}>
     <option value="">Toutes les catégories</option>
     {categories.map(item=><option key={item} value={item}>{item}</option>)}
    </select>
   </label>
   <label>Trier
    <select aria-label="Trier les produits" value={sort} onChange={e=>{setSort(e.target.value as CatalogSort);setVisibleCount(24);}}
     style={{display:'block',padding:12,border:'1px solid #bacbd4',borderRadius:9}}>
     <option value="featured">Ordre du catalogue</option>
     <option value="price-asc">Prix croissant</option>
     <option value="price-desc">Prix décroissant</option>
     <option value="name">Nom A–Z</option>
    </select>
   </label>
   <label style={{padding:'12px 0',display:'flex',gap:8,alignItems:'center'}}>
    <input type="checkbox" checked={availableOnly} onChange={e=>{setAvailableOnly(e.target.checked);setVisibleCount(24);}}/>
    Disponibles uniquement
   </label>
  </div>
  <p aria-live="polite" style={{margin:'0 0 16px'}}>{matching.length} produit(s) correspondant(s) · {shown.length} affiché(s)</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:16}}>
   {shown.map(product=><article key={product.id} style={{
    display:'flex',flexDirection:'column',gap:8,border:'1px solid '+accent,borderRadius:16,
    padding:16,background:surface,color:foreground,minWidth:0
   }}>
    {product.imageUrl&&<img src={product.imageUrl} alt={'Photo de '+product.name}
     loading="lazy" decoding="async" referrerPolicy="no-referrer"
     style={{display:'block',width:'100%',height:190,objectFit:'contain',borderRadius:12,background:'#f8fafc'}}/>}
    <span style={{fontSize:13,fontWeight:700,color:accent}}>{product.category||'Article'}</span>
    <h3 style={{margin:'3px 0'}}>{product.name}</h3>
    {product.variant&&<p style={{margin:0}}>{product.variant}</p>}
    {product.description&&<p style={{margin:'3px 0',lineHeight:1.5}}>{product.description}</p>}
    <p style={{margin:'5px 0',fontWeight:800,fontSize:21}}>{money(product.price)} TND</p>
    <p style={{margin:'3px 0'}}>{product.available?'Disponible':'Rupture de stock'}</p>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:'auto',paddingTop:10}}>
     <Link href={shopPath+'/produit/'+encodeURIComponent(product.id)} style={{color:accent,fontWeight:600,padding:'10px 0'}}>
      Voir la fiche
     </Link>
     {product.available&&<Link href={shopPath+'?produit='+encodeURIComponent(product.id)+'#panier'}
      style={{background:accent,color:'#fff',borderRadius:9,padding:'10px 13px',textDecoration:'none',fontWeight:700}}>
      Ajouter au panier
     </Link>}
    </div>
   </article>)}
  </div>
  {matching.length===0&&<p role="status">Aucun article ne correspond à votre recherche. Modifiez les filtres.</p>}
  {matching.length>visibleCount&&<button type="button"
   onClick={()=>setVisibleCount(count=>count+24)}
   style={{marginTop:20,border:'1px solid '+accent,borderRadius:10,padding:'12px 18px',
    background:surface,color:foreground,cursor:'pointer',fontWeight:700}}>
   Afficher plus de produits ({matching.length-visibleCount} restants)
  </button>}
 </section>;
}
