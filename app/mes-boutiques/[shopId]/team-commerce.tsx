'use client';
import {useEffect,useRef,useState} from 'react';
import {contactChannels,contactOutcomes,contactLogNote,type ContactChannel,type ContactOutcome} from '../../../modules/shops/contact-history';

type Section='products'|'orders'|'finance';
type Item={id:string;name:string;sku:string;stock:number;price:number};
type Order={id:string;reference:string;status:string;createdAt:string;customer?:{name:string;phone:string;city:string};total?:number;items:{name:string;quantity:number}[];contactLog?:{at:string;label:string}[]};
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
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [stockQty,setStockQty]=useState<Record<string,string>>({});
 const [channels,setChannels]=useState<Record<string,ContactChannel>>({});
 const [outcomes,setOutcomes]=useState<Record<string,ContactOutcome>>({});
 const pending=useRef<{fingerprint:string;requestId:string}|null>(null);
 const [revision,setRevision]=useState(0);
 const canAdjustStock=['OWNER','ADMIN','MANAGER','STOCK'].includes(role);
 const canConfirm=['OWNER','ADMIN','MANAGER','CALL_CENTER','DELIVERY_MANAGER'].includes(role);
 const canLogContact=['OWNER','ADMIN','MANAGER','CALL_CENTER'].includes(role);
 function recordContact(order:Order){
  if(!window.confirm('Enregistrer uniquement un contact réellement effectué ? Aucun appel, WhatsApp ou SMS ne sera envoyé.'))return;
  const channel=channels[order.id]||'Téléphone';
  const outcome=outcomes[order.id]||'Sans réponse';
  void perform('callNote',{id:order.id,note:contactLogNote(channel,outcome)});
 }
 async function perform(action:'adjustStock'|'confirmOrder'|'callNote',payload:unknown){
  const fingerprint=JSON.stringify({action,payload});
  const requestId=pending.current?.fingerprint===fingerprint?pending.current.requestId:crypto.randomUUID();
  pending.current={fingerprint,requestId};
  setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/team-actions',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,payload,requestId})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Opération refusée');
   pending.current=null;
   setNotice(action==='callNote'?'Tentative de contact manuelle enregistrée dans l’historique.':'Action enregistrée pour cette boutique.');
   setRevision(value=>value+1);
  }catch(e){setNotice(e instanceof Error?e.message:'Erreur réseau');}
  finally{setBusy(false);}
 }

 useEffect(()=>{
  let active=true;setLoading(true);setError('');setData(null);
  fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/team-view?section='+section,{cache:'no-store'}).then(async response=>{
   const result=await response.json() as Response;
   if(!response.ok)throw new Error(result.error||'Accès refusé');
   if(active)setData(result);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Chargement impossible');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[shopId,section,revision]);
 return <section style={{marginTop:16,padding:24,border:'1px solid #dce4e8',borderRadius:18,background:'#fff'}}>
  <h2>Espace collaborateur</h2>
  <p style={{color:'#566477'}}>Rôle : {role}. Chaque consultation et action respecte les permissions de cette boutique.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  <div style={{display:'flex',flexWrap:'wrap',gap:8,margin:'14px 0'}}>
   {labels.map(item=><button key={item.value} type="button" aria-pressed={section===item.value}
    onClick={()=>setSection(item.value)} style={{padding:'9px 14px',borderRadius:8,
    background:section===item.value?'#126c65':'#f0f4f5',color:section===item.value?'white':'#24333b',border:0}}>
    {item.label}</button>)}
  </div>
  {loading?<p>Chargement des données autorisées…</p>:error?<p role="alert">{error}</p>:data&&<>
   {data.section==='products'&&<div style={{overflowX:'auto'}}>
    <table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Produit</th><th>SKU</th><th>Prix</th><th>Stock</th>{canAdjustStock&&<th>Action</th>}</tr></thead>
     <tbody>{data.products?.map(product=><tr key={product.id}>
      <td>{product.name}</td><td>{product.sku}</td><td>{(product.price/1000).toFixed(3)} TND</td><td>{product.stock}</td>
      {canAdjustStock&&<td><form onSubmit={event=>{event.preventDefault();const quantity=Number(stockQty[product.id]);if(Number.isSafeInteger(quantity)&&quantity!==0)void perform('adjustStock',{id:product.id,quantity,reason:'Ajustement du magasinier'});}}>
       <input aria-label={'Ajuster '+product.name} type="number" min="-100000" max="100000" step="1" value={stockQty[product.id]||''} onChange={event=>setStockQty(values=>({...values,[product.id]:event.target.value}))} style={{width:80,padding:7}}/>
       <button type="submit" disabled={busy}>Ajuster</button></form></td>}
     </tr>)}</tbody>
    </table>{!data.products?.length&&<p>Aucun produit.</p>}
   </div>}
   {data.section==='orders'&&<div style={{overflowX:'auto'}}>
    <table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Commande</th><th>Statut</th><th>Articles</th><th>Client autorisé</th>{canConfirm&&<th>Action</th>}{canLogContact&&<th>Journal des contacts</th>}</tr></thead>
     <tbody>{data.orders?.map(order=><tr key={order.id}>
      <td>{order.reference}</td><td>{order.status}</td>
      <td>{order.items.map(item=>item.name+' × '+item.quantity).join(', ')}</td>
      <td>{order.customer?order.customer.name+' · '+order.customer.phone:'Données masquées'}</td>
      {canConfirm&&<td>{['TO_CONFIRM','NO_ANSWER','CALLBACK'].includes(order.status)&&<button type="button" disabled={busy} onClick={()=>void perform('confirmOrder',{id:order.id,status:'CONFIRMED'})}>Confirmer</button>}</td>}
      {canLogContact&&<td style={{minWidth:230,padding:8}}>
       {['TO_CONFIRM','NO_ANSWER','CALLBACK'].includes(order.status)&&<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        <label>Canal<select aria-label={'Canal '+order.reference} value={channels[order.id]||'Téléphone'} onChange={event=>setChannels(previous=>({...previous,[order.id]:event.target.value as ContactChannel}))}>{contactChannels.map(channel=><option key={channel}>{channel}</option>)}</select></label>
        <label>Résultat<select aria-label={'Résultat '+order.reference} value={outcomes[order.id]||'Sans réponse'} onChange={event=>setOutcomes(previous=>({...previous,[order.id]:event.target.value as ContactOutcome}))}>{contactOutcomes.map(outcome=><option key={outcome}>{outcome}</option>)}</select></label>
        <button type="button" disabled={busy} onClick={()=>recordContact(order)}>Journaliser</button>
       </div>}
       {order.contactLog?.length?<details><summary>{order.contactLog.length} dernier(s) contact(s) manuel(s)</summary><ul>{order.contactLog.map((entry,i)=><li key={i}>{new Date(entry.at).toLocaleString('fr-TN')} · {entry.label}</li>)}</ul></details>:<small>Aucun contact déclaré</small>}
      </td>}
     </tr>)}</tbody>
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
