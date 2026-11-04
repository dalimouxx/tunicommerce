'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {replenishmentQueue,pageOperationalQueue} from '../../../modules/shops/operational-queues';
import {productEditPayload,merchantInventoryCsv,type CatalogEdit} from '../../../modules/shops/catalog-operations';

type Product={id:string;sku:string;name:string;category:string;variant:string;price:number;cost:number;stock:number;threshold:number;color:string;active:boolean};
const toTnd=(millimes:number)=>(millimes/1000).toFixed(3);
const toMillimes=(value:string)=>Math.round(Number(value)*1000);

export default function ShopInventory({shopId}:{shopId:string}){
 const [products,setProducts]=useState<Product[]>([]);
 const [search,setSearch]=useState('');
 const [onlyLowStock,setOnlyLowStock]=useState(false);
 const [page,setPage]=useState(1);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [name,setName]=useState('');
 const [sku,setSku]=useState('');
 const [price,setPrice]=useState('');
 const [cost,setCost]=useState('');
 const [openingStock,setOpeningStock]=useState('0');
 const [stockAdjust,setStockAdjust]=useState<Record<string,string>>({});
 const [editing,setEditing]=useState('');
 const [edit,setEdit]=useState<CatalogEdit>({name:'',sku:'',category:'',variant:'',price:'0',cost:'0',threshold:'0'});
 const lowStock=replenishmentQueue(products);
 const needle=search.trim().toLocaleLowerCase('fr');
 const filteredProducts=products.filter(p=>(!onlyLowStock||(p.active&&p.stock<=p.threshold))&&
  (!needle||[p.name,p.sku,p.category,p.variant].join(' ').toLocaleLowerCase('fr').includes(needle)));
 const visibleProducts=pageOperationalQueue(filteredProducts,page,40);
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/inventory';
 useEffect(()=>{
  let active=true;
  fetch(url,{cache:'no-store'}).then(async r=>{
   const data=await r.json() as {products?:Product[];error?:string};
   if(!r.ok)throw new Error(data.error||'Catalogue indisponible');
   if(active)setProducts(data.products||[]);
  }).catch(e=>{if(active)setNotice(e instanceof Error?e.message:'Erreur réseau');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[url]);
 async function mutate(action:'product'|'stock',payload:unknown){
  setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,payload,requestId:crypto.randomUUID()})});
   const data=await response.json() as {products?:Product[];error?:string};
   if(!response.ok)throw new Error(data.error||'Enregistrement impossible');
   setProducts(data.products||[]);
   setNotice('Modification enregistrée dans cette boutique.');
   return true;
  }catch(e){setNotice(e instanceof Error?e.message:'Erreur réseau');return false;}
  finally{setBusy(false);}
 }
 async function add(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const stock=Number(openingStock);
  if(!Number.isSafeInteger(stock)||stock<0){setNotice('Stock initial invalide');return;}
  const result=await mutate('product',{
   name,sku,category:'Général',variant:'',price:toMillimes(price),cost:toMillimes(cost),
   stock,threshold:2,color:'#cbd5e1'
  });
  if(result){setName('');setSku('');setPrice('');setCost('');setOpeningStock('0');}
 }
 function openEdit(product:Product){
  setEditing(product.id);
  setEdit({name:product.name,sku:product.sku,category:product.category,variant:product.variant,
   price:toTnd(product.price),cost:toTnd(product.cost),threshold:String(product.threshold)});
 }
 async function saveEdit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const product=products.find(p=>p.id===editing);
  if(!product)return;
  try{
   const payload=productEditPayload(product,edit);
   if(await mutate('product',payload))setEditing('');
  }catch(error){setNotice(error instanceof Error?error.message:'Champs invalides');}
 }
 function exportCatalog(){
  const content=merchantInventoryCsv(products);
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='catalogue-boutique.csv';
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section style={{background:'white',padding:24,borderRadius:18,border:'1px solid #e0e6ee',marginTop:16}}>
  <h2>Catalogue et stock indépendants</h2>
  <p style={{color:'#566477'}}>Ces produits appartiennent uniquement à cette boutique. La quantité de produits autorisée dépend de votre formule SaaS et des plafonds globaux de votre compte.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement du catalogue…</p>:<>
   <form onSubmit={e=>void add(e)} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',margin:'18px 0'}}>
    <label>Produit<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} style={{display:'block',padding:10}}/></label>
    <label>SKU<input required maxLength={160} value={sku} onChange={e=>setSku(e.target.value)} style={{display:'block',padding:10}}/></label>
    <label>Prix (TND)<input required type="number" min="0" max="1000000" step="0.001" value={price} onChange={e=>setPrice(e.target.value)} style={{display:'block',padding:10,width:120}}/></label>
    <label>Coût (TND)<input required type="number" min="0" max="1000000" step="0.001" value={cost} onChange={e=>setCost(e.target.value)} style={{display:'block',padding:10,width:120}}/></label>
    <label>Stock initial<input required type="number" min="0" max="100000" step="1" value={openingStock} onChange={e=>setOpeningStock(e.target.value)} style={{display:'block',padding:10,width:110}}/></label>
    <button type="submit" disabled={busy} style={{border:0,borderRadius:10,padding:'12px 16px',background:'#126c65',color:'white',fontWeight:700}}>Ajouter le produit</button>
   </form>
   <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',margin:'14px 0'}}>
    <button type="button" disabled={busy||products.length===0} onClick={exportCatalog}>Exporter mon catalogue en CSV</button>
    <a href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/import-catalogue'} style={{display:'inline-block',padding:10,border:'1px solid #b9d5d8',borderRadius:8}}>Importer un catalogue CSV (100 produits max.)</a>
    <span style={{fontSize:13,color:'#526477'}}>Export privé : contient les coûts d'achat et les stocks de cette boutique.</span>
   </div>
   {editing&&<form onSubmit={event=>void saveEdit(event)} style={{border:'1px solid #b7d9d5',borderRadius:12,padding:16,display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',marginBottom:16}}>
    <strong style={{width:'100%'}}>Modifier le produit sélectionné</strong>
    {([
     ['name','Nom',160],['sku','SKU',160],['category','Catégorie',160],['variant','Variante',100]
    ] as const).map(([field,label,maxLength])=><label key={field}>{label}<input required={field!=='variant'} maxLength={maxLength} value={edit[field]} onChange={event=>setEdit(values=>({...values,[field]:event.target.value}))} style={{display:'block',padding:9}}/></label>)}
    <label>Prix (TND)<input type="number" required min="0" max="1000000" step="0.001" value={edit.price} onChange={event=>setEdit(v=>({...v,price:event.target.value}))} style={{display:'block',padding:9,width:125}}/></label>
    <label>Coût (TND)<input type="number" required min="0" max="1000000" step="0.001" value={edit.cost} onChange={event=>setEdit(v=>({...v,cost:event.target.value}))} style={{display:'block',padding:9,width:125}}/></label>
    <label>Seuil d’alerte<input type="number" required min="0" max="1000000" step="1" value={edit.threshold} onChange={event=>setEdit(v=>({...v,threshold:event.target.value}))} style={{display:'block',padding:9,width:112}}/></label>
    <button disabled={busy} type="submit">Enregistrer les modifications</button>
    <button disabled={busy} type="button" onClick={()=>setEditing('')}>Annuler</button>
    <p style={{width:'100%',fontSize:13,color:'#53687a'}}>Le stock actuel reste inchangé : utilisez les ajustements de stock pour les mouvements physiques.</p>
   </form>}
   {lowStock.length>0&&<div style={{border:'1px solid #ead2a6',background:'#fff9ed',borderRadius:12,padding:14,marginBottom:16}}>
    <strong>Alertes de stock · {lowStock.length} produit(s)</strong>
    <p style={{margin:'8px 0'}}>Ces articles sont épuisés ou à leur seuil de réapprovisionnement. Les quantités proposées sont indicatives pour dépasser le seuil, sans commande fournisseur automatique.</p>
    <ul>{lowStock.slice(0,10).map(p=><li key={p.id}>{p.name} ({p.sku}) : {p.stock} unité(s), seuil {p.threshold} · {p.outOfStock?'RUPTURE · ':''}réapprovisionnement minimum suggéré : {p.suggestedMinimum}</li>)}</ul>
    {lowStock.length>10&&<p>Et {lowStock.length-10} autres articles à vérifier. <button type="button" onClick={()=>{setOnlyLowStock(true);setSearch('');setPage(1);}}>Voir toutes les ruptures et alertes</button></p>}
   </div>}
   <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',margin:'14px 0'}}>
    <label>Rechercher un produit<input type="search" value={search} maxLength={100}
     onChange={e=>{setSearch(e.target.value);setPage(1);}}
     placeholder="Nom, SKU, catégorie" style={{display:'block',padding:9}}/></label>
    <label><input type="checkbox" checked={onlyLowStock}
     onChange={e=>{setOnlyLowStock(e.target.checked);setPage(1);}}/> Uniquement ruptures et seuils de stock</label>
    <span aria-live="polite">{filteredProducts.length} produit(s) trouvé(s)</span>
   </div>
   <nav aria-label="Pages du catalogue" style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',margin:'12px 0'}}>
    <button type="button" disabled={visibleProducts.page===1||busy} onClick={()=>setPage(n=>Math.max(1,n-1))}>Précédents</button>
    <span>Page {visibleProducts.page}/{visibleProducts.totalPages}</span>
    <button type="button" disabled={visibleProducts.page>=visibleProducts.totalPages||busy} onClick={()=>setPage(n=>Math.min(n+1,visibleProducts.totalPages))}>Suivants</button>
   </nav>
   <div style={{overflowX:'auto'}}>
    <table style={{borderCollapse:'collapse',width:'100%',textAlign:'left'}}>
     <thead><tr><th>Référence</th><th>Produit</th><th>Prix</th><th>Stock</th><th>Ajustement</th><th>Catalogue</th></tr></thead>
     <tbody>{visibleProducts.items.map(p=><tr key={p.id} style={{borderTop:'1px solid #e5ebee'}}>
      <td style={{padding:12}}>{p.sku}</td><td style={{padding:12}}>{p.name}</td>
      <td style={{padding:12}}>{toTnd(p.price)} TND</td><td style={{padding:12}}>{p.stock}</td>
      <td style={{padding:12}}><form onSubmit={e=>{e.preventDefault();const qty=Number(stockAdjust[p.id]);if(Number.isSafeInteger(qty)&&qty!==0)void mutate('stock',{id:p.id,quantity:qty,reason:'Ajustement manuel du stock'});}} style={{display:'flex',gap:8}}>
       <input aria-label={'Quantité à ajuster pour '+p.name} type="number" step="1" min="-100000" max="100000" value={stockAdjust[p.id]||''} onChange={e=>setStockAdjust(x=>({...x,[p.id]:e.target.value}))} placeholder="+/-" style={{width:90,padding:7}}/>
       <button disabled={busy} type="submit">Valider</button>
      </form></td>
      <td style={{padding:12}}><button type="button" disabled={busy} onClick={()=>openEdit(p)}>Modifier</button></td>
     </tr>)}</tbody>
    </table>
    {products.length===0?<p>Aucun produit. Ajoutez le premier article de cette boutique.</p>:visibleProducts.total===0?<p>Aucun article ne correspond aux filtres.</p>:null}
   </div>
  </>}
 </section>;
}
