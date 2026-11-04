'use client';
import {useEffect,useMemo,useState} from 'react';
import {pageOperationalQueue} from '../../../modules/shops/operational-queues';

type Customer={name:string;phone:string;city:string;orderCount:number;deliveredCount:number;deliveredGrossMillimes:number};
export default function ShopCustomers({shopId}:{shopId:string}){
 const [customers,setCustomers]=useState<Customer[]>([]);
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(1);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError('');
  fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/customers',{cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const data=await response.json() as {customers?:Customer[];error?:string};
    if(!response.ok)throw new Error(data.error||'Répertoire indisponible');
    setCustomers(data.customers||[]);
   }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Erreur réseau');})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[shopId]);
 const visible=useMemo(()=>{
  const needle=query.trim().toLocaleLowerCase('fr');
  return customers.filter(c=>[c.name,c.phone,c.city].join(' ').toLocaleLowerCase('fr').includes(needle));
 },[customers,query]);
 const current=pageOperationalQueue(visible,page,50);
 return <section style={{background:'#fff',border:'1px solid #e0e6ee',borderRadius:18,padding:24,marginTop:16}}>
  <h2>Clients de cette boutique</h2>
  <p style={{color:'#566477'}}>Répertoire privé du propriétaire, alimenté par les commandes enregistrées dans cette boutique. Consultation uniquement.</p>
  {loading?<p>Chargement…</p>:error?<p role="alert">{error}</p>:<>
   <label style={{display:'block',margin:'16px 0'}}>Rechercher un client
    <input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Nom, téléphone ou ville" style={{display:'block',padding:10,width:'min(100%,340px)',marginTop:6}}/>
   </label>
   <p aria-live="polite">{visible.length} client(s) trouvé(s)</p>
   <nav aria-label="Pages du répertoire clients" style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',margin:'12px 0'}}>
    <button type="button" disabled={current.page===1} onClick={()=>setPage(n=>Math.max(1,n-1))}>Clients précédents</button>
    <span>Page {current.page}/{current.totalPages}</span>
    <button type="button" disabled={current.page>=current.totalPages} onClick={()=>setPage(n=>Math.min(n+1,current.totalPages))}>Clients suivants</button>
   </nav>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
    <thead><tr><th>Client</th><th>Téléphone</th><th>Ville</th><th>Commandes</th><th>Livrées</th><th>Ventes livrées</th></tr></thead>
    <tbody>{current.items.map((customer,index)=><tr key={customer.phone+'-'+index} style={{borderTop:'1px solid #e0e6ee'}}>
     <td style={{padding:10}}>{customer.name}</td><td style={{padding:10}}>{customer.phone}</td><td style={{padding:10}}>{customer.city}</td>
     <td style={{padding:10}}>{customer.orderCount}</td><td style={{padding:10}}>{customer.deliveredCount}</td>
     <td style={{padding:10}}>{(customer.deliveredGrossMillimes/1000).toFixed(3)} TND</td>
    </tr>)}</tbody>
   </table></div>
   {visible.length>50&&<p>Utilisez les pages pour parcourir tout le répertoire, même au-delà de 100 clients.</p>}
   {visible.length===0&&<p>Aucun client correspondant.</p>}
  </>}
 </section>;
}
