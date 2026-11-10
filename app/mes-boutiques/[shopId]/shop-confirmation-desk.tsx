'use client';
import {useEffect,useRef,useState} from 'react';
import {confirmationQueue,pageOperationalQueue} from '../../../modules/shops/operational-queues';
import ShopManualMessages from './shop-manual-messages';
import {contactChannels,contactOutcomes,contactHistory,contactLogNote,contactHistoryStats,type ContactChannel,type ContactOutcome} from '../../../modules/shops/contact-history';

type Order={id:string;reference:string;status:string;customerSnapshot?:{name:string;phone:string;city:string};items:{name:string;quantity:number}[];callbackAt:string;events:{at:string;label:string}[]};

export default function ShopConfirmationDesk({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/orders';
 const [orders,setOrders]=useState<Order[]>([]);
 const [queuePage,setQueuePage]=useState(1);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [notice,setNotice]=useState('');
 const [callbackDates,setCallbackDates]=useState<Record<string,string>>({});
 const [channels,setChannels]=useState<Record<string,ContactChannel>>({});
 const [outcomes,setOutcomes]=useState<Record<string,ContactOutcome>>({});
 const pending=useRef<Record<string,{action:'transition';payload:{id:string;status:string;callbackAt?:string};requestId:string}>>({});
 const notesPending=useRef<Record<string,{action:'note';payload:{id:string;note:string};requestId:string}>>({});
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
  const scheduled=status==='CALLBACK'?new Date(callbackDates[id]||''):null;
  if(scheduled&&(!Number.isFinite(scheduled.getTime())||scheduled.getTime()<=Date.now())){
   setNotice('Choisissez une date de rappel future.');return;
  }
  const callbackAt=scheduled?.toISOString();
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
 async function recordContact(order:Order){
  const channel=channels[order.id]||'Téléphone';
  const outcome=outcomes[order.id]||'Sans réponse';
  if(!window.confirm('Confirmer que ce contact a réellement été effectué ? Aucun appel ou message ne sera envoyé par Tunicom.'))return;
  const note=contactLogNote(channel,outcome);
  const key=order.id+':'+note;
  const previous=notesPending.current[key];
  const request=previous||{action:'note' as const,payload:{id:order.id,note},requestId:crypto.randomUUID()};
  notesPending.current[key]=request;setBusy(order.id);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
   const result=await response.json() as {orders?:Order[];error?:string};
   if(!response.ok)throw new Error(result.error||'Contact non enregistré');
   setOrders(result.orders||[]);delete notesPending.current[key];
   setNotice('Tentative manuelle enregistrée dans l’historique de la commande.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez sans modifier le résultat.');}
  finally{setBusy('');}
 }
 const toProcess=confirmationQueue(orders);
 const displayQueue=pageOperationalQueue(toProcess,queuePage,30);
 const contactStats=contactHistoryStats(orders);
 const overdueCount=toProcess.filter(order=>order.priority==='OVERDUE').length;
 const scheduledCount=toProcess.filter(order=>order.priority==='SCHEDULED').length;
 return <section style={{background:'white',padding:24,borderRadius:18,border:'1px solid #e0e6ee',marginTop:16}}>
  <h2>Centre de confirmation · Boutique indépendante</h2>
  <p style={{color:'#566477'}}>Confirmer, noter sans réponse, programmer un rappel ou annuler. Aucune communication téléphonique ou WhatsApp n'est envoyée automatiquement.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement…</p>:<>
   <p>{toProcess.length} commande(s) dans la file · {overdueCount} rappel(s) à effectuer · {scheduledCount} rappel(s) à venir · {contactStats.attempts} tentative(s) manuelle(s) enregistrée(s).</p>
   <p>Les résultats ci-dessous sont saisis par les agents et ne constituent pas une preuve d’appel ou de message envoyé.</p>
   <nav aria-label="Pages du Call Center" style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',margin:'12px 0'}}>
    <button type="button" disabled={displayQueue.page===1||!!busy} onClick={()=>setQueuePage(n=>Math.max(1,n-1))}>Précédentes</button>
    <span>Page {displayQueue.page}/{displayQueue.totalPages} · {displayQueue.total} commande(s)</span>
    <button type="button" disabled={displayQueue.page>=displayQueue.totalPages||!!busy} onClick={()=>setQueuePage(n=>Math.min(n+1,displayQueue.totalPages))}>Suivantes</button>
   </nav>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}> 
    <thead><tr><th>Commande</th><th>Client</th><th>Articles</th><th>Statut</th><th>Actions</th></tr></thead>
    <tbody>{displayQueue.items.map(order=><tr key={order.id} style={{borderTop:'1px solid #e0e6ee'}}>
     <td style={{padding:10}}>{order.reference}</td>
     <td style={{padding:10}}>{order.customerSnapshot?order.customerSnapshot.name+' · '+order.customerSnapshot.phone:'Client non renseigné'}</td>
     <td style={{padding:10}}>{order.items.map(i=>i.name+' × '+i.quantity).join(', ')}</td>
     <td style={{padding:10}}>{order.status}{order.priority==='OVERDUE'?' · Rappel dû':order.priority==='SCHEDULED'?' · Rappel prévu':''}{order.callbackAt&&order.status==='CALLBACK'&&Number.isFinite(Date.parse(order.callbackAt))?' · '+new Date(order.callbackAt).toLocaleString('fr-TN'):''}</td>
     <td style={{padding:10}}>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
       <button disabled={!!busy} onClick={()=>void change(order.id,'CONFIRMED')}>Confirmer</button>
       {order.status!=='NO_ANSWER'&&<button disabled={!!busy} onClick={()=>void change(order.id,'NO_ANSWER')}>Sans réponse</button>}
       <label>Rappel<input type="datetime-local" aria-label={'Date du rappel '+order.reference} value={callbackDates[order.id]||''} onChange={e=>setCallbackDates(values=>({...values,[order.id]:e.target.value}))}/></label>
       <button disabled={!!busy||order.status==='CALLBACK'||!callbackDates[order.id]||Number.isNaN(new Date(callbackDates[order.id]).getTime())||new Date(callbackDates[order.id]).getTime()<=Date.now()} onClick={()=>void change(order.id,'CALLBACK')}>Planifier</button>
       <button disabled={!!busy} onClick={()=>{if(window.confirm('Annuler '+order.reference+' et libérer le stock ?'))void change(order.id,'CANCELLED');}}>Annuler</button>
       <label>Canal déclaré<select aria-label={'Canal contact '+order.reference} value={channels[order.id]||'Téléphone'} onChange={e=>setChannels(values=>({...values,[order.id]:e.target.value as ContactChannel}))}>{contactChannels.map(channel=><option key={channel}>{channel}</option>)}</select></label>
       <label>Résultat déclaré<select aria-label={'Résultat contact '+order.reference} value={outcomes[order.id]||'Sans réponse'} onChange={e=>setOutcomes(values=>({...values,[order.id]:e.target.value as ContactOutcome}))}>{contactOutcomes.map(outcome=><option key={outcome}>{outcome}</option>)}</select></label>
       <button disabled={!!busy} onClick={()=>void recordContact(order)}>Enregistrer le contact effectué</button>
      </div>
      {contactHistory(order).length>0&&<details><summary>Historique des contacts manuels ({contactHistory(order).length})</summary><ul>{contactHistory(order).map((entry,i)=><li key={i}>{new Date(entry.at).toLocaleString('fr-TN')} · {entry.label}</li>)}</ul></details>}
     </td>
    </tr>)}</tbody>
   </table></div>
   {toProcess.length===0&&<p>Aucune commande à confirmer.</p>}
   <ShopManualMessages orders={orders}/>
   {toProcess.length>30&&<p>La pagination permet de traiter toutes les commandes, y compris les rappels anciens.</p>}
  </>}
 </section>;
}
