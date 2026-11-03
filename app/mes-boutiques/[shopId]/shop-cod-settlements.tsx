'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';

type Order={id:string;reference:string;totalMillimes:number;collectedMillimes:number;remainingMillimes:number};
type Entry={id:string;orderReference:string;amountMillimes:number;reference:string;at:string};
type Api={orders?:Order[];history?:Entry[];error?:string;alreadyApplied?:boolean};
const display=(value:number)=>(value/1000).toFixed(3);
export default function ShopCodSettlements({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/cod-settlements';
 const [orders,setOrders]=useState<Order[]>([]);
 const [history,setHistory]=useState<Entry[]>([]);
 const [selected,setSelected]=useState('');
 const [amount,setAmount]=useState('');
 const [reference,setReference]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const requestId=useRef<string|null>(null);
 const payable=orders.filter(order=>order.remainingMillimes>0);
 const active=payable.find(order=>order.id===selected);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setNotice('');setOrders([]);setHistory([]);setSelected('');
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json() as Api;
   if(!response.ok)throw new Error(data.error||'Encaissements indisponibles');
   setOrders(data.orders||[]);setHistory(data.history||[]);
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const millimes=Math.round(Number(amount)*1000);
  if(!active||!Number.isSafeInteger(millimes)||millimes<1||millimes>active.remainingMillimes){
   setNotice('Montant supérieur au restant dû ou commande invalide.');return;
  }
  const id=requestId.current||crypto.randomUUID();requestId.current=id;
  setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'settlement',requestId:id,payload:{id:active.id,amount:millimes,reference}})});
   const data=await response.json() as Api;
   if(!response.ok)throw new Error(data.error||'Versement refusé');
   setOrders(data.orders||[]);setHistory(data.history||[]);
   setAmount('');setReference('');setSelected('');requestId.current=null;
   setNotice(data.alreadyApplied?'Versement déjà enregistré ; aucun doublon créé.':'Versement COD enregistré pour cette boutique.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez sans modifier les champs.');}
  finally{setBusy(false);}
 }
 return <section style={{background:'#fff',border:'1px solid #e0e6ee',borderRadius:18,padding:24,marginTop:16}}>
  <h2>Encaissements COD · Cette boutique</h2>
  <p style={{color:'#566477'}}>Versements partiels sur commandes livrées uniquement. Montants en TND, sans accès aux commandes d'autres boutiques.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement des encaissements…</p>:<>
   <form onSubmit={event=>void submit(event)} style={{display:'flex',alignItems:'end',gap:10,flexWrap:'wrap',margin:'18px 0'}}>
    <label>Commande livrée<select required value={active?.id||''} onChange={event=>{setSelected(event.target.value);requestId.current=null;}} style={{display:'block',padding:10,minWidth:190}}>
     <option value="" disabled>Sélectionner une commande</option>
     {payable.map(order=><option key={order.id} value={order.id}>{order.reference} · restant {display(order.remainingMillimes)} TND</option>)}
    </select></label>
    <label>Versement (TND)<input required type="number" min="0.001" max={active?display(active.remainingMillimes):undefined} step="0.001" value={amount} onChange={event=>{setAmount(event.target.value);requestId.current=null;}} style={{display:'block',padding:10,width:145}}/></label>
    <label>Référence de versement<input required maxLength={160} value={reference} onChange={event=>{setReference(event.target.value);requestId.current=null;}} placeholder="Reçu ou transporteur" style={{display:'block',padding:10}}/></label>
    <button type="submit" disabled={busy||!active} style={{padding:'12px 16px',background:'#126c65',color:'#fff',border:0,borderRadius:10,fontWeight:700}}>Enregistrer le versement</button>
   </form>
   <p>Commandes livrées restant à encaisser : {payable.length}. COD restant : {display(payable.reduce((total,order)=>total+order.remainingMillimes,0))} TND.</p>
   <div style={{overflowX:'auto',marginTop:14}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
    <thead><tr><th>Commande</th><th>Référence versement</th><th>Montant</th><th>Date</th></tr></thead>
    <tbody>{history.map(entry=><tr key={entry.id} style={{borderTop:'1px solid #e0e6ee'}}>
     <td style={{padding:10}}>{entry.orderReference}</td><td style={{padding:10}}>{entry.reference}</td>
     <td style={{padding:10}}>{display(entry.amountMillimes)} TND</td><td style={{padding:10}}>{new Date(entry.at).toLocaleString('fr-TN')}</td>
    </tr>)}</tbody>
   </table>{!history.length&&<p>Aucun versement COD enregistré.</p>}</div>
  </>}
 </section>;
}
