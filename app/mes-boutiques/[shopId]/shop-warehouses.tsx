'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';

type Location={id:string;code:string;name:string;active:boolean};
type Product={id:string;sku:string;name:string;total:number;byLocation:{warehouseId:string;quantity:number}[]};
type Transfer={id:string;productId:string;fromId:string;toId:string;quantity:number;reference:string;at:string};
type Result={initialized?:boolean;locations?:Location[];products?:Product[];transfers?:Transfer[];
 inconsistencies?:string[];alreadyApplied?:boolean;error?:string};
export default function ShopWarehouses({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/warehouses';
 const [data,setData]=useState<Result|null>(null),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [name,setName]=useState(''),[code,setCode]=useState('');
 const [productId,setProductId]=useState(''),[fromId,setFromId]=useState('primary'),[toId,setToId]=useState('');
 const [quantity,setQuantity]=useState('1'),[reference,setReference]=useState('');
 const pending=useRef<{key:string;requestId:string}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const d=await response.json() as Result;if(!response.ok)throw Error(d.error||'Emplacements indisponibles');
   if(!controller.signal.aborted)setData(d);
  }).catch(e=>{if(!controller.signal.aborted)setNotice(e instanceof Error?e.message:'Erreur réseau');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[url]);
 async function send(action:'initializeWarehouses'|'createWarehouse'|'transferWarehouseStock',payload:Record<string,unknown>){
  const key=JSON.stringify({action,payload});
  const requestId=pending.current?.key===key?pending.current.requestId:crypto.randomUUID();
  pending.current={key,requestId};setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,payload,requestId})});
   const result=await response.json() as Result;
   if(!response.ok)throw Error(result.error||'Modification refusée');
   setData(result);pending.current=null;
   setNotice(result.alreadyApplied?'Opération déjà enregistrée, aucun doublon.':'Opération enregistrée et contrôlée.');
   return true;
  }catch(e){setNotice(e instanceof Error?e.message:'Échec réseau. Réessayez sans modifier les informations.');return false;}
  finally{setBusy(false);}
 }
 async function createLocation(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(await send('createWarehouse',{name,code:code.trim().toUpperCase()})){setName('');setCode('');}
 }
 async function transfer(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const amount=Number(quantity);
  if(!Number.isSafeInteger(amount)||amount<1){setNotice('Quantité entière positive requise');return;}
  if(!window.confirm('Confirmer le transfert physique de '+amount+' unité(s) ? Le stock total restera inchangé.'))return;
  if(await send('transferWarehouseStock',{productId,fromId,toId,quantity:amount,reference:reference.trim()}))setReference('');
 }
 const locations=data?.locations||[],products=data?.products||[];
 const active=locations.filter(x=>x.active);
 return <section style={{marginTop:16,padding:24,background:'white',border:'1px solid #dce7ec',borderRadius:16}}>
  <h2>Stocks multi-dépôts</h2>
  <p>Le stock total de la boutique reste la référence des ventes. Les emplacements détaillent où se trouvent les unités et les sorties de commandes privilégient le dépôt principal, puis les autres dépôts. Les transferts ne changent pas le total.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement…</p>:!data?.initialized?<div>
   <p>Le multi-dépôt n'est pas activé. Tous les stocks actuels seront affectés au dépôt principal, sans supprimer ni modifier les quantités enregistrées.</p>
   <button type="button" disabled={busy} onClick={()=>void send('initializeWarehouses',{})}>Activer et répartir le stock existant</button>
  </div>:<>
   {(data.inconsistencies||[]).length>0&&<p role="alert" style={{color:'#a13226'}}>
    Stock incohérent sur : {data.inconsistencies?.join(', ')}. Suspendez les transferts et vérifiez l'historique.
   </p>}
   <h3>Mes dépôts ({active.length})</h3>
   <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{active.map(x=><div key={x.id} style={{padding:12,border:'1px solid #dbe5ed',borderRadius:10}}>
    <strong>{x.name}</strong><p>{x.code}</p>
   </div>)}</div>
   <form onSubmit={e=>void createLocation(e)} style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap',marginTop:16}}>
    <label>Nom du dépôt<input required maxLength={80} minLength={2} value={name} onChange={e=>{setName(e.target.value);pending.current=null;}} style={{display:'block',padding:9}}/></label>
    <label>Code dépôt<input required maxLength={20} minLength={2} pattern="[A-Za-z0-9_-]+" value={code} onChange={e=>{setCode(e.target.value);pending.current=null;}} style={{display:'block',padding:9}}/></label>
    <button type="submit" disabled={busy||active.length>=20}>Ajouter ce dépôt</button>
   </form>
   <h3>Transfert physique entre dépôts</h3>
   <form onSubmit={e=>void transfer(e)} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
    <label>Produit<select required value={productId} onChange={e=>{setProductId(e.target.value);pending.current=null;}} style={{display:'block',padding:10}}>
     <option value="" disabled>Choisir un produit</option>{products.map(x=><option key={x.id} value={x.id}>{x.sku} · {x.name} · total {x.total}</option>)}
    </select></label>
    <label>Dépôt source<select required value={fromId} onChange={e=>{setFromId(e.target.value);pending.current=null;}} style={{display:'block',padding:10}}>
     {active.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
    </select></label>
    <label>Dépôt de destination<select required value={toId} onChange={e=>{setToId(e.target.value);pending.current=null;}} style={{display:'block',padding:10}}>
     <option value="" disabled>Choisir une destination</option>{active.filter(x=>x.id!==fromId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
    </select></label>
    <label>Quantité<input required type="number" step="1" min="1" max="100000" value={quantity} onChange={e=>{setQuantity(e.target.value);pending.current=null;}} style={{display:'block',padding:9,width:100}}/></label>
    <label>Référence du bon<input required minLength={3} maxLength={160} value={reference} onChange={e=>{setReference(e.target.value);pending.current=null;}} style={{display:'block',padding:9}}/></label>
    <button type="submit" disabled={busy||active.length<2||!productId||!toId||toId===fromId||(data.inconsistencies||[]).length>0}>Enregistrer le transfert</button>
   </form>
   <h3>Répartition actuelle</h3>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
    <thead><tr><th>Article</th><th>Stock total</th>{active.map(x=><th key={x.id}>{x.code}</th>)}</tr></thead>
    <tbody>{products.map(p=><tr key={p.id} style={{borderTop:'1px solid #e0e7ed'}}>
     <td style={{padding:9}}>{p.sku} · {p.name}</td><td style={{padding:9}}>{p.total}</td>
     {active.map(x=><td key={x.id} style={{padding:9}}>{p.byLocation.find(b=>b.warehouseId===x.id)?.quantity||0}</td>)}
    </tr>)}</tbody></table></div>
   <h3>Derniers transferts</h3>
   <ul>{(data.transfers||[]).map(x=><li key={x.id}>{x.reference} · {products.find(p=>p.id===x.productId)?.sku||'Article'} · {x.quantity} unité(s) · {locations.find(l=>l.id===x.fromId)?.code} → {locations.find(l=>l.id===x.toId)?.code} · {new Date(x.at).toLocaleString('fr-TN')}</li>)}</ul>
   {products.length>=500&&<p>Seuls les 500 premiers articles sont affichés. Les opérations serveur restent vérifiées.</p>}
  </>}
 </section>;
}
