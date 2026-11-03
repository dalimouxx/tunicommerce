'use client';
import {useEffect,useRef,useState} from 'react';

type Order={id:string;reference:string;status:string;customerSnapshot?:{name:string;phone:string;city:string};items:{name:string;quantity:number}[];callbackAt:string;events:{at:string;label:string}[]};
const due=new Set(['TO_CONFIRM','NO_ANSWER','CALLBACK']);

export default function ShopConfirmationDesk({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/orders';
 const [orders,setOrders]=useState<Order[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [notice,setNotice]=useState('');
 const [callbackDates,setCallbackDates]=useState<Record<string,string>>({});
 const pending=useRef<Record<string,{action:'transition';payload:{id:string;status:string;callbackAt?:string};requestId:string}>>({});
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json() as {orders?:Order[];error?:string};
   if(!response.ok)throw new Error(data.error||'Commandes indisponibles');
   if(!controller.signal.aborted)setOrders(data.orders||[]);
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur de chargement');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url]);

 async function change(id:string,status:'CONFIRMED'|'NO_ANSWER'|'CALLBACK'|'CANCELLED'){
  const callbackAt=status==='CALLBACK'?new Date(callbackDates[id]||'').toISOString():undefined;
  const key=id+':'+status;
  const payload={id,status,...(callbackAt?{callbackAt}:{})};
  const existing=pending.current[key];
  const request=existing&&JSON.stringify(existing.payload)===JSON.stringify(payload)?existing:
   {action:'transition' as const,payload,requestId:crypto.randomUUID()};
  pending.current[key]=request;setBusy(id);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
   const result=await response.json() as {orders?:Order[];error?:string};
   if(!response.ok)throw new Error(result.error||'Transition refusée');
   setOrders(result.orders||[]);
   delete pending.current[key];
   setNotice('Statut enregistré pour cette boutique.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau');}
  finally{setBusy('');}
 }
 const toProcess=orders.filter(order=>due.has(order.status));
 return <section style={{background:'white',padding:24,borderRadius:18,border:'1px solid #e0e6ee',marginTop:16}}>
  <h2>Centre de confirmation · Boutique indépendante</h2>
  <p style={{color:'#566477'}}>Confirmer, noter sans réponse, programmer un rappel ou annuler. Aucune communication téléphonique ou WhatsApp n'est envoyée automatiquement.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement…</p>:<>
   <p>{toProcess.length} commande(s) à traiter</p>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
    <thead><tr><th>Commande</th><th>Client</th><th>Articles</th><th>Statut</th><th>Actions</th></tr></thead>
    <tbody>{toProcess.slice(0,30).map(order=><tr key={order.id} style={{borderTop:'1px solid #e0e6ee'}}>
     <td style={{padding:10}}>{order.reference}</td>
     <td style={{padding:10}}>{order.customerSnapshot?order.customerSnapshot.name+' · '+order.customerSnapshot.phone:'Client non renseigné'}</td>
     <td style={{padding:10}}>{order.items.map(i=>i.name+' × '+i.quantity).join(', ')}</td>
     <td style={{padding:10}}>{order.status}{order.callbackAt&&order.status==='CALLBACK'?' · '+new Date(order.callbackAt).toLocaleString('fr-TN'):''}</td>
     <td style={{padding:10}}>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
       <button disabled={!!busy} onClick={()=>void change(order.id,'CONFIRMED')}>Confirmer</button>
       {order.status!=='NO_ANSWER'&&<button disabled={!!busy} onClick={()=>void change(order.id,'NO_ANSWER')}>Sans réponse</button>}
       <label>Rappel<input type="datetime-local" aria-label={'Date du rappel '+order.reference} value={callbackDates[order.id]||''} onChange={e=>setCallbackDates(values=>({...values,[order.id]:e.target.value}))}/></label>
       <button disabled={!!busy||!callbackDates[order.id]||Number.isNaN(new Date(callbackDates[order.id]).getTime())||new Date(callbackDates[order.id]).getTime()<=Date.now()} onClick={()=>void change(order.id,'CALLBACK')}>Planifier</button>
       <button disabled={!!busy} onClick={()=>{if(window.confirm('Annuler '+order.reference+' et libérer le stock ?'))void change(order.id,'CANCELLED');}}>Annuler</button>
      </div>
     </td>
    </tr>)}</tbody>
   </table></div>
   {toProcess.length===0&&<p>Aucune commande à confirmer.</p>}
   {toProcess.length>30&&<p>30 premières commandes affichées.</p>}
  </>}
 </section>;
}
