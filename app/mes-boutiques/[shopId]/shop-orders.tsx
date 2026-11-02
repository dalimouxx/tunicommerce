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
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [city,setCity]=useState('Tunis');
 const [address,setAddress]=useState('');
 const [productId,setProductId]=useState('');
 const [quantity,setQuantity]=useState('1');
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
  if(!productId){setNotice('Choisissez un produit');return;}
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
   if(inventory.ok){const updated=await inventory.json() as {products:Product[]};setProducts(updated.products);}
   setName('');setPhone('');setAddress('');setQuantity('1');
   setNotice('Commande enregistrée dans cette boutique.');
  }catch(e){setNotice(e instanceof Error?e.message:'Erreur réseau');}
  finally{setBusy(false);}
 }
 return <section style={{background:'white',borderRadius:18,padding:24,border:'1px solid #e0e6ee',marginTop:16}}>
  <h2>Commandes de cette boutique</h2>
  <p style={{color:'#556477'}}>Pilote : commandes manuelles privées, limitées à 10 par mois et soumises aux quotas existants. Aucun checkout public activé.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement…</p>:<>
   <form onSubmit={e=>void create(e)} style={{display:'flex',flexWrap:'wrap',alignItems:'end',gap:10,margin:'18px 0'}}>
    <label>Nom du client<input required value={name} onChange={e=>setName(e.target.value)} style={{display:'block',padding:10}}/></label>
    <label>Téléphone tunisien<input required pattern="(\\+216)?[2459][0-9]{7}" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="22123456" style={{display:'block',padding:10}}/></label>
    <label>Gouvernorat<select value={city} onChange={e=>setCity(e.target.value)} style={{display:'block',padding:10}}>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Adresse<input required value={address} onChange={e=>setAddress(e.target.value)} style={{display:'block',padding:10}}/></label>
    <label>Produit<select required value={productId} onChange={e=>setProductId(e.target.value)} style={{display:'block',padding:10,maxWidth:200}}>{products.filter(p=>p.active&&p.stock>0).map(p=><option key={p.id} value={p.id}>{p.name} · {p.stock} en stock</option>)}</select></label>
    <label>Quantité<input required type="number" min="1" max="10000" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} style={{display:'block',padding:10,width:90}}/></label>
    <button type="submit" disabled={busy||products.every(p=>!p.active||p.stock<1)} style={{padding:'12px 16px',border:0,borderRadius:10,color:'white',background:'#126c65',fontWeight:700}}>Créer la commande</button>
   </form>
   <div style={{overflowX:'auto'}}>
    <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
     <thead><tr><th>Référence</th><th>Produit(s)</th><th>Statut</th><th>Montant</th><th>Date</th></tr></thead>
     <tbody>{orders.slice(0,30).map(o=><tr key={o.id} style={{borderTop:'1px solid #e0e6ee'}}>
      <td style={{padding:10}}>{o.reference}</td>
      <td style={{padding:10}}>{o.items.map(i=>i.name+' × '+i.quantity).join(', ')}</td>
      <td style={{padding:10}}>{o.status}</td>
      <td style={{padding:10}}>{toTnd(o.total)} TND</td>
      <td style={{padding:10}}>{new Date(o.createdAt).toLocaleDateString('fr-TN')}</td>
     </tr>)}</tbody>
    </table>
    {!orders.length&&<p>Aucune commande pour cette boutique.</p>}
   </div>
  </>}
 </section>;
}
