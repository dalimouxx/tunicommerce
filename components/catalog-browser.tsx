'use client';
import {useState,useRef,type FormEvent} from 'react';
import {money,type Product} from '../modules/commerce/types';
import type {CatalogQuery} from '../modules/shops/catalog-query';
import styles from './catalog-browser.module.css';
type Result={shopName:string;source:string;catalogVersion:number;total:number;page:number;pages:number;pageSize:number;offset:number;products:Product[]};
export default function CatalogBrowser({shopId,initial}:{shopId:string;initial:Result}){
 const [data,setData]=useState(initial),[search,setSearch]=useState(''),[status,setStatus]=useState<CatalogQuery['status']>('all'),[stock,setStock]=useState<CatalogQuery['stock']>('all');
 const [query,setQuery]=useState<CatalogQuery>({q:'',status:'all',stock:'all',page:1,pageSize:40});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const sequence=useRef(0),url='/api/v1/shops/'+encodeURIComponent(shopId)+'/catalog';
 async function load(next:CatalogQuery,refresh=false){
  const seq=++sequence.current;setBusy(true);setError('');setNotice('');
  try{
   if(refresh){const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'refresh'}),signal:AbortSignal.timeout(45000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Actualisation indisponible.');}
   const params=new URLSearchParams(Object.entries(next).map(([k,v])=>[k,String(v)]));
   const response=await fetch(url+'?'+params,{cache:'no-store',signal:AbortSignal.timeout(45000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Recherche indisponible.');
   if(seq!==sequence.current)return;
   setData(result);setQuery({...next,page:result.page});
   if(refresh)setNotice('Catalogue actualisé. Vos produits et vos commandes sont conservés.');
  }catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'Recherche indisponible.');}
  finally{if(seq===sequence.current)setBusy(false);}
 }
 function submit(event:FormEvent){event.preventDefault();void load({q:search.trim(),status,stock,page:1,pageSize:40});}
 return <><header className={styles.header}><div><span className={styles.eyebrow}>VOTRE COLLECTION, EN UN CLIN D’ŒIL</span><h1>Mon catalogue<span>↗</span></h1>
  <p>Retrouvez vos références, repérez les ruptures et gardez une longueur d’avance.</p></div><button className={styles.secondary} disabled={busy} onClick={()=>void load(query,true)}>Actualiser le catalogue</button></header>
  <section className={styles.panel}><form className={styles.filters} onSubmit={submit}>
   <label className={styles.search}>Trouver un produit<input type="search" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, référence, catégorie…" disabled={busy}/></label>
   <label>Publication<select value={status} onChange={e=>setStatus(e.target.value as CatalogQuery['status'])} disabled={busy}><option value="all">Tous les produits</option><option value="active">Actifs</option><option value="inactive">Inactifs</option></select></label>
   <label>Stock<select value={stock} onChange={e=>setStock(e.target.value as CatalogQuery['stock'])} disabled={busy}><option value="all">Tous les stocks</option><option value="low">À réapprovisionner</option><option value="out">En rupture</option></select></label>
   <button className={styles.primary} disabled={busy}>{busy?'Recherche…':'Rechercher'}</button>
  </form></section>
  {error&&<p className={styles.error} role="alert">{error} Les derniers résultats restent affichés.</p>}
  {notice&&<p className={styles.notice} role="status">{notice}</p>}
  <section className={styles.panel} aria-busy={busy} aria-label="Résultats du catalogue">
   <div className={styles.resultHead}><h2>{data.total} produit{data.total>1?'s':''}</h2><span>Page {data.page} sur {data.pages}</span></div>
   {data.products.length?<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Produit</th><th>Référence</th><th>Prix</th><th>Stock</th><th>État</th></tr></thead>
    <tbody>{data.products.map(product=><tr key={product.id}><td><strong dir="auto">{product.name}</strong><small dir="auto">{[product.category,product.variant].filter(Boolean).join(' · ')}</small></td>
     <td>{product.sku}</td><td>{money(product.price)} TND</td><td><span className={product.active&&product.stock<=product.threshold?styles.low:styles.stock}>{product.stock}</span></td>
     <td><span className={product.active?styles.active:styles.inactive}>{product.active?'Actif':'Inactif'}</span></td></tr>)}</tbody></table></div>:
    <div className={styles.empty}><strong>Aucun produit dans cette sélection</strong><p>Essayez une autre référence ou élargissez les filtres.</p></div>}
   <nav className={styles.pagination} aria-label="Pages du catalogue"><button className={styles.secondary} disabled={busy||data.page<=1} onClick={()=>void load({...query,page:data.page-1})}>← Précédente</button>
    <span>{data.total?data.offset+1:0}–{Math.min(data.offset+data.products.length,data.total)} sur {data.total}</span>
    <button className={styles.secondary} disabled={busy||data.page>=data.pages} onClick={()=>void load({...query,page:data.page+1})}>Suivante →</button></nav>
  </section></>;
}
