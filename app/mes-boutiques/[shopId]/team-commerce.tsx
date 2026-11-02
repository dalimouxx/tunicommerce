'use client';
import {useEffect,useState} from 'react';

type Section='products'|'orders'|'finance';
type Item={id:string;name:string;sku:string;stock:number;price:number};
type Order={id:string;reference:string;status:string;createdAt:string;customer?:{name:string;phone:string;city:string};total?:number;items:{name:string;quantity:number}[]};
type Finance={delivered:number;deliveredGrossMillimes:number;codOutstandingMillimes:number};
type Response={section:Section;products?:Item[];orders?:Order[];summary?:Finance;error?:string};
const labels:{value:Section;label:string}[]=[
 {value:'products',label:'Produits'},{value:'orders',label:'Commandes'},{value:'finance',label:'Comptabilité'}
];

export default function TeamCommerce({shopId,role}:{shopId:string;role:string}){
 const [section,setSection]=useState<Section>(role==='ACCOUNTANT'?'finance':role==='STOCK'?'products':'orders');
 const [data,setData]=useState<Response|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;setLoading(true);setError('');setData(null);
  fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/team-view?section='+section,{cache:'no-store'}).then(async response=>{
   const result=await response.json() as Response;
   if(!response.ok)throw new Error(result.error||'Accès refusé');
   if(active)setData(result);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Chargement impossible');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[shopId,section]);
 return <section style={{marginTop:16,padding:24,border:'1px solid #dce4e8',borderRadius:18,background:'#fff'}}>
  <h2>Espace collaborateur</h2>
  <p style={{color:'#566477'}}>Rôle : {role}. Consultation limitée à vos permissions, sans pouvoir modifier les données commerciales.</p>
  <div style={{display:'flex',flexWrap:'wrap',gap:8,margin:'14px 0'}}>
   {labels.map(item=><button key={item.value} type="button" aria-pressed={section===item.value}
    onClick={()=>setSection(item.value)} style={{padding:'9px 14px',borderRadius:8,
    background:section===item.value?'#126c65':'#f0f4f5',color:section===item.value?'white':'#24333b',border:0}}>
    {item.label}</button>)}
  </div>
  {loading?<p>Chargement des données autorisées…</p>:error?<p role="alert">{error}</p>:data&&<>
   {data.section==='products'&&<div style={{overflowX:'auto'}}>
    <table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Produit</th><th>SKU</th><th>Prix</th><th>Stock</th></tr></thead>
     <tbody>{data.products?.map(product=><tr key={product.id}>
      <td>{product.name}</td><td>{product.sku}</td><td>{(product.price/1000).toFixed(3)} TND</td><td>{product.stock}</td></tr>)}</tbody>
    </table>{!data.products?.length&&<p>Aucun produit.</p>}
   </div>}
   {data.section==='orders'&&<div style={{overflowX:'auto'}}>
    <table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Commande</th><th>Statut</th><th>Articles</th><th>Client autorisé</th></tr></thead>
     <tbody>{data.orders?.map(order=><tr key={order.id}>
      <td>{order.reference}</td><td>{order.status}</td>
      <td>{order.items.map(item=>item.name+' × '+item.quantity).join(', ')}</td>
      <td>{order.customer?order.customer.name+' · '+order.customer.phone:'Données masquées'}</td></tr>)}</tbody>
    </table>{!data.orders?.length&&<p>Aucune commande.</p>}
   </div>}
   {data.section==='finance'&&data.summary&&<div style={{display:'flex',gap:18,flexWrap:'wrap'}}>
    <span>Livrées : {data.summary.delivered}</span>
    <span>Ventes livrées : {(data.summary.deliveredGrossMillimes/1000).toFixed(3)} TND</span>
    <span>COD restant : {(data.summary.codOutstandingMillimes/1000).toFixed(3)} TND</span>
   </div>}
  </>}
 </section>;
}
