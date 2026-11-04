'use client';
import {useEffect,useRef,useState} from 'react';
import {fulfillmentQueue} from '../../../modules/shops/order-fulfillment';
import ShopDispatchExports from './shop-dispatch-exports';
import {eligibleCarriers} from '../../../modules/shops/carrier-dispatch-planner';
import type {Carrier} from '../../../modules/commerce/types';

type Order={
 id:string;reference:string;status:string;total:number;createdAt:string;
 items:{name:string;variant:string;quantity:number}[];
 customerSnapshot?:{name:string;phone:string;city:string;address:string};
 carrier:string;tracking:string;carrierId?:string
};
type Transition='PREPARING'|'READY'|'SHIPPED'|'DELIVERED';
type Request={action:'transition';requestId:string;payload:{id:string;status:Transition;carrier?:string;tracking?:string;carrierId?:string}};

export default function ShopFulfillment({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/orders';
 const [orders,setOrders]=useState<Order[]>([]);
 const [carrier,setCarrier]=useState<Record<string,string>>({});
 const [carrierIds,setCarrierIds]=useState<Record<string,string>>({});
 const [registeredCarriers,setRegisteredCarriers]=useState<Carrier[]>([]);
 const [tracking,setTracking]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [page,setPage]=useState(1);
 const [notice,setNotice]=useState('');
 const pending=useRef<Record<string,Request>>({});
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setNotice('');
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json() as {orders?:Order[];error?:string};
   if(!response.ok)throw Error(data.error||'Commandes indisponibles');
   if(!controller.signal.aborted)setOrders(data.orders||[]);
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
  .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/carriers',{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)return;
   const result=await response.json() as {carriers?:Carrier[]};
   if(!controller.signal.aborted)setRegisteredCarriers(result.carriers||[]);
  }).catch(()=>{});
  return()=>controller.abort();
 },[url]);

 async function advance(order:Order,status:Transition){
  if(status==='DELIVERED'&&!window.confirm('Confirmer que la commande '+order.reference+' a réellement été livrée ?'))return;
  const chosenId=carrierIds[order.id]||'';
  const extra=status==='SHIPPED'?{carrier:chosenId?'':(carrier[order.id]||'').trim(),tracking:(tracking[order.id]||'').trim(),...(chosenId?{carrierId:chosenId}:{})}:{};
  if(status==='SHIPPED'&&(!('carrier' in extra&&(extra.carrier||('carrierId' in extra&&extra.carrierId)))||!('tracking' in extra&&extra.tracking))){
   setNotice('Transporteur et numéro de suivi sont obligatoires pour expédier.');return;
  }
  const payload={id:order.id,status,...extra};
  const key=order.id+':'+status;
  const previous=pending.current[key];
  const request=previous&&JSON.stringify(previous.payload)===JSON.stringify(payload)?previous:
   {action:'transition' as const,requestId:crypto.randomUUID(),payload};
  pending.current[key]=request;setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
   const result=await response.json() as {orders?:Order[];error?:string};
   if(!response.ok)throw Error(result.error||'Transition refusée');
   setOrders(result.orders||[]);
   delete pending.current[key];
   setNotice('Commande '+order.reference+' mise à jour. Le statut est maintenant visible dans le suivi client.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez sans modifier les champs.');}
  finally{setBusy(false);}
 }
 const queue=fulfillmentQueue(orders);
 const pageSize=30,totalPages=Math.max(1,Math.ceil(queue.length/pageSize));
 const currentPage=Math.min(page,totalPages);
 return <section style={{background:'#fff',border:'1px solid #e0e6ee',borderRadius:18,padding:24,marginTop:16}}>
  <h2>Préparation, expédition et livraison</h2>
  <ShopDispatchExports shopId={shopId}/>
  <p><a href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/bordereaux'}>Imprimer les étiquettes de préparation et comparer les frais configurés</a></p>
  <p style={{fontSize:13,color:'#566477'}}>Export limité aux commandes de cette boutique et réservé au propriétaire. Il contient les adresses et téléphones des destinataires : conservez-le dans un emplacement sécurisé. Aucune transmission automatique à un transporteur.</p>
  <p style={{color:'#566477'}}>Seules les commandes de cette boutique sont affichées. Les transitions sont contrôlées par le serveur ; déclarer « Livrée » exige une confirmation manuelle.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement des commandes…</p>:<>
   <p>{queue.length} commande(s) à préparer, expédier ou clôturer. Page {currentPage}/{totalPages}.</p>
   <div style={{display:'flex',gap:12,alignItems:'center',margin:'12px 0',flexWrap:'wrap'}}>
    <button type="button" disabled={currentPage===1||busy} onClick={()=>setPage(n=>Math.max(1,n-1))}>Précédente</button>
    <span>Page {currentPage} / {totalPages}</span>
    <button type="button" disabled={currentPage>=totalPages||busy} onClick={()=>setPage(n=>Math.min(totalPages,n+1))}>Suivante</button>
   </div>
   <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',textAlign:'left',width:'100%'}}>
    <thead><tr><th>Commande et client</th><th>Articles à préparer</th><th>État</th><th>Action</th></tr></thead>
    <tbody>{queue.slice((currentPage-1)*pageSize,currentPage*pageSize).map(order=><tr key={order.id} style={{borderTop:'1px solid #e5ebee'}}>
     <td style={{padding:10}}><strong>{order.reference}</strong>
      <p>{order.customerSnapshot?.name||'Client'} · {order.customerSnapshot?.phone||'Numéro indisponible'}</p>
      <p>{order.customerSnapshot?.city||''} · {order.customerSnapshot?.address||''}</p>
      <p>{(order.total/1000).toFixed(3)} TND</p>
     </td>
     <td style={{padding:10}}>{order.items.map((item,i)=><p key={i}>{item.name}{item.variant?' · '+item.variant:''} × {item.quantity}</p>)}</td>
     <td style={{padding:10}}>{order.status}</td>
     <td style={{padding:10}}>
      {order.status==='CONFIRMED'&&<button disabled={busy} onClick={()=>void advance(order,'PREPARING')}>Commencer préparation</button>}
      {order.status==='PREPARING'&&<button disabled={busy} onClick={()=>void advance(order,'READY')}>Colis prêt</button>}
      {order.status==='READY'&&<div style={{display:'grid',gap:6}}>
       <label>Transporteur configuré<select value={carrierIds[order.id]||''} onChange={e=>setCarrierIds(x=>({...x,[order.id]:e.target.value}))}>
        <option value="">Aucun · saisie manuelle</option>
        {eligibleCarriers({carriers:registeredCarriers},order.customerSnapshot?.city||'').map(c=><option key={c.id} value={c.id}>{c.name} · {(c.deliveryCost/1000).toFixed(3)} TND</option>)}
       </select></label>
       {!carrierIds[order.id]&&<label>Transporteur manuel<input maxLength={160} value={carrier[order.id]||''} onChange={e=>setCarrier(x=>({...x,[order.id]:e.target.value}))} placeholder="Nom du transporteur"/></label>}
       <label>Numéro de suivi<input maxLength={160} value={tracking[order.id]||''} onChange={e=>setTracking(x=>({...x,[order.id]:e.target.value}))} placeholder="Référence unique"/></label>
       <button disabled={busy} onClick={()=>void advance(order,'SHIPPED')}>Confirmer l'expédition</button>
      </div>}
      {order.status==='SHIPPED'&&<div>
       <p>Transporteur : {order.carrier||'Non renseigné'} · {order.tracking||'Sans suivi'}</p>
       <button disabled={busy} onClick={()=>void advance(order,'DELIVERED')}>Marquer livrée</button>
      </div>}
     </td>
    </tr>)}</tbody>
   </table></div>
   {queue.length===0&&<p>Aucune commande en préparation ou en livraison.</p>}
   {queue.length>pageSize&&<p>Utilisez les pages ci-dessus pour traiter toutes les commandes, sans limite silencieuse.</p>}
  </>}
 </section>;
}
