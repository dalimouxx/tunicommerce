'use client';
import {useEffect,useState,type FormEvent} from 'react';

type Order={id:string;reference:string;status:string;total:number;source:string;createdAt:string;items:{name:string;quantity:number}[]};
type Product={id:string;name:string;stock:number;price:number;active:boolean};
const cities=['Tunis','Ariana','Ben Arous','Manouba','Nabeul','Zaghouan','Bizerte','Béja','Jendouba','Le Kef','Siliana','Sousse','Monastir','Mahdia','Sfax','Kairouan','Kasserine','Sidi Bouzid','Gabès','Médenine','Tataouine','Gafsa','Tozeur','Kébili'];
const toTnd=(millimes:number)=>(millimes/1000).toFixed(3);

export default function ShopOrders({shopId}:{shopId:string}){
 const base='/api/v1/shops/'+encodeURIComponent(shopId);
 const [orders,setOrders]=useState<Order[]>([]);
 const [products,setProducts]=useState<Product[]>([]);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [notice,setNotice]=useState('');
 const [query,setQuery]=useState('');
 const [statusFilter,setStatusFilter]=useState('ALL');
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [city,setCity]=useState('Tunis');
 const [address,setAddress]=useState('');
 const [productId,setProductId]=useState('');
 const [quantity,setQuantity]=useState('1');
 const availableProducts=products.filter(p=>p.active&&p.stock>0);
 const selectedProductAvailable=availableProducts.some(p=>p.id===productId);
 const normalizedQuery=query.trim().toLocaleLowerCase('fr');
 const filteredOrders=orders.filter(o=>(statusFilter==='ALL'||o.status===statusFilter)&&(
  !normalizedQuery||[o.reference,...o.items.map(item=>item.name)].join(' ').toLocaleLowerCase('fr').includes(normalizedQuery)
 ));
 const statuses=Array.from(new Set(orders.map(o=>o.status))).sort();
 useEffect(()=>{
  let active=true;
  Promise.all([
   fetch(base+'/orders',{cache:'no-store'}),
   fetch(base+'/inventory',{cache:'no-store'})
  ]).then(async ([o,p])=>{
   if(!o.ok||!p.ok)throw new Error('Chargement de la boutique indisponible');
   const orderData=await o.json() as {orders:Order[]};
   const catalog=await p.json() as {products:Product[]};
   if(active){setOrders(orderData.orders);setProducts(catalog.products);setProductId(catalog.products[0]?.id||'');}
  }).catch(e=>{if(active)setNotice(e instanceof Error?e.message:'Erreur réseau');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[base]);
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const count=Number(quantity);
  if(!Number.isSafeInteger(count)||count<1){setNotice('Quantité invalide');return;}
  if(!selectedProductAvailable){setNotice('Choisissez un produit encore disponible');return;}
  const selectedProduct=availableProducts.find(p=>p.id===productId);
  if(!selectedProduct||count>selectedProduct.stock){setNotice('Stock insuffisant pour cette quantité');return;}
  setBusy(true);setNotice('');
  try{
   const response=await fetch(base+'/orders',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'createOrder',requestId:crypto.randomUUID(),payload:{
     name,phone,city,address,source:'Manuel',items:[{productId,quantity:count}]
    }})
   });
   const data=await response.json() as {orders?:Order[];error?:string};
   if(!response.ok)throw new Error(data.error||'Commande impossible');
   setOrders(data.orders||[]);
   const inventory=await fetch(base+'/inventory',{cache:'no-store'});
   if(inventory.ok){const updated=await inventory.json() as {products:Product[]};setProducts(updated.products);setProductId(current=>updated.products.some(p=>p.id===current&&p.active&&p.stock>0)?current:updated.products.find(p=>p.active&&p.stock>0)?.id||'');}
   setName('');setPhone('');setAddress('');setQuantity('1');
   setNotice('Commande enregistrée dans cette boutique.');
  }catch(e){setNotice(e instanceof Error?e.message:'Erreur réseau');}
  finally{setBusy(false);}
 }
 return <section style={{background:'white',borderRadius:18,padding:24,border:'1px solid #e0e6ee',marginTop:16}}>
  <h2>Commandes de cette boutique</h2>
  <p style={{color:'#556477'}}>Commandes manuelles et commandes publiques COD : plafonds définis par votre formule SaaS, toutes boutiques du même marchand confondues.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement…</p>:<>
   <form onSubmit={e=>void create(e)} style={{display:'flex',flexWrap:'wrap',alignItems:'end',gap:10,margin:'18px 0'}}>
    <label>Nom du client<input required value={name} onChange={e=>setName(e.target.value)} style={{display:'block',padding:10}}/></label>
    <label>Téléphone tunisien<input required pattern="(\\+216)?[2459][0-9]{7}" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="22123456" style={{display:'block',padding:10}}/></label>
    <label>Gouvernorat<select value={city} onChange={e=>setCity(e.target.value)} style={{display:'block',padding:10}}>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Adresse<input required value={address} onChange={e=>setAddress(e.target.value)} style={{display:'block',padding:10}}/></label>
    <label>Produit<select required value={selectedProductAvailable?productId:''} onChange={e=>setProductId(e.target.value)} style={{display:'block',padding:10,maxWidth:200}}><option value="" disabled>Choisir un produit</option>{availableProducts.map(p=><option key={p.id} value={p.id}>{p.name} · {p.stock} en stock</option>)}</select></label>
    <label>Quantité<input required type="number" min="1" max="10000" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} style={{display:'block',padding:10,width:90}}/></label>
    <button type="submit" disabled={busy||!selectedProductAvailable} style={{padding:'12px 16px',border:0,borderRadius:10,color:'white',background:'#126c65',fontWeight:700}}>Créer la commande</button>
   </form>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',margin:'16px 0'}}>
    <label>Rechercher une commande<input aria-label="Rechercher par référence ou article" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence ou produit" style={{display:'block',padding:10}}/></label>
    <label>Filtrer par statut<select aria-label="Filtrer par statut" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{display:'block',padding:10}}><option value="ALL">Tous les statuts</option>{statuses.map(status=><option key={status} value={status}>{status}</option>)}</select></label>
    <span aria-live="polite">{filteredOrders.length} commande(s) correspondante(s)</span>
   </div>
   <div style={{overflowX:'auto'}}>
    <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
     <thead><tr><th>Référence</th><th>Produit(s)</th><th>Statut</th><th>Montant</th><th>Date</th></tr></thead>
     <tbody>{filteredOrders.slice(0,30).map(o=><tr key={o.id} style={{borderTop:'1px solid #e0e6ee'}}>
      <td style={{padding:10}}>{o.reference}</td>
      <td style={{padding:10}}>{o.items.map(i=>i.name+' × '+i.quantity).join(', ')}</td>
      <td style={{padding:10}}>{o.status}</td>
      <td style={{padding:10}}>{toTnd(o.total)} TND</td>
      <td style={{padding:10}}>{new Date(o.createdAt).toLocaleDateString('fr-TN')}</td>
     </tr>)}</tbody>
    </table>
    {!orders.length?<p>Aucune commande pour cette boutique.</p>:filteredOrders.length===0?<p>Aucune commande ne correspond à vos filtres.</p>:filteredOrders.length>30?<p>Les 30 premiers résultats sont affichés. Affinez la recherche pour voir d'autres commandes.</p>:null}
   </div>
  </>}
 </section>;
}
