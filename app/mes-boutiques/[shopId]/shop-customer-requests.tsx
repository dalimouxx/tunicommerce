'use client';
import {useEffect,useRef,useState} from 'react';

type CustomerRequest={id:string;type:'CANCEL'|'RETURN';reason:string;at:string;
 status:'PENDING'|'ACCEPTED'|'REJECTED';reply?:string};
type Order={id:string;reference:string;status:string;customerRequests?:CustomerRequest[]};
type ResponseBody={orders?:Order[];alreadyApplied?:boolean;error?:string};

export default function ShopCustomerRequests({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/orders';
 const [orders,setOrders]=useState<Order[]>([]);
 const [reply,setReply]=useState<Record<string,string>>({});
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState('');
 const [loading,setLoading]=useState(true);
 const pending=useRef<Record<string,{id:string;body:string}>>({});
 const pendingRows=orders.flatMap(order=>(order.customerRequests||[])
  .filter(request=>request.status==='PENDING').map(request=>({order,request})));
 const history=orders.flatMap(order=>(order.customerRequests||[])
  .filter(request=>request.status!=='PENDING').map(request=>({order,request})));
 async function refresh(){
  setLoading(true);setNotice('');
  try{
   const res=await fetch(url,{cache:'no-store'});
   const data=await res.json() as ResponseBody;
   if(!res.ok)throw Error(data.error||'Demandes client indisponibles');
   setOrders(data.orders||[]);
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau');}
  finally{setLoading(false);}
 }
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async res=>{
   const data=await res.json() as ResponseBody;
   if(!res.ok)throw Error(data.error||'Demandes client indisponibles');
   if(!controller.signal.aborted)setOrders(data.orders||[]);
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url]);
 async function decide(order:Order,request:CustomerRequest,status:'ACCEPTED'|'REJECTED'){
  const text=(reply[request.id]||'').trim();
  if(text.length<3){setNotice('Indiquez une réponse de 3 caractères minimum.');return;}
  if(status==='ACCEPTED'){
   const warning=request.type==='CANCEL'
    ?'Accepter cette annulation peut libérer automatiquement le stock réservé. Confirmez-vous la décision ?'
    :'Accepter cette demande de retour ne rembourse aucun montant et ne réceptionne aucun article. Continuer ?';
   if(!window.confirm(warning))return;
  }
  const payload={orderId:order.id,requestId:request.id,status,reply:text};
  const body=JSON.stringify(payload);
  const key=request.id+':'+status;
  const previous=pending.current[key];
  const id=previous?.body===body?previous.id:crypto.randomUUID();
  pending.current[key]={id,body};setBusy(request.id);setNotice('');
  try{
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'resolveCustomerRequest',requestId:id,payload})});
   const result=await res.json() as ResponseBody;
   if(!res.ok)throw Error(result.error||'Décision refusée');
   setOrders(result.orders||[]);
   delete pending.current[key];
   setReply(old=>({...old,[request.id]:''}));
   setNotice(result.alreadyApplied?'Décision déjà enregistrée, sans doublon.':
    'Décision enregistrée. Une demande de retour acceptée doit encore être traitée dans le module Retours.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau : réessayez avec la même réponse.');}
  finally{setBusy('');}
 }
 return <section style={{background:'#fff',padding:22,border:'1px solid #dbe5eb',borderRadius:16,marginTop:16}}>
  <h2>Demandes clients · Annulations et retours</h2>
  <p>Demandes reçues via les liens de suivi privés. Seul le propriétaire de la boutique peut prendre une décision.
   Un retour accepté n'entraîne aucun remboursement ou mouvement de stock automatique.</p>
  <button type="button" disabled={!!busy} onClick={()=>void refresh()}>Actualiser les demandes</button>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement…</p>:<>
   <p><strong>{pendingRows.length}</strong> demande(s) en attente · {history.length} décision(s) déjà enregistrée(s).</p>
   <div style={{display:'grid',gap:12}}>
    {pendingRows.slice(0,50).map(({order,request})=><article key={request.id}
     style={{padding:14,border:'1px solid #dde6ed',borderRadius:12}}>
     <h3>{order.reference} · {request.type==='CANCEL'?'Annulation':'Retour'}</h3>
     <p>État de la commande : {order.status} · reçu le {new Date(request.at).toLocaleString('fr-TN')}</p>
     <p>Motif transmis : {request.reason}</p>
     <label>Votre réponse au client
      <textarea rows={2} minLength={3} maxLength={500} value={reply[request.id]||''}
       onChange={event=>{setReply(old=>({...old,[request.id]:event.target.value}));delete pending.current[request.id+':ACCEPTED'];delete pending.current[request.id+':REJECTED'];}}
       style={{display:'block',width:'100%',maxWidth:550,padding:10}}/>
     </label>
     <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}>
      <button type="button" disabled={!!busy||(reply[request.id]||'').trim().length<3}
       onClick={()=>void decide(order,request,'ACCEPTED')}>Accepter</button>
      <button type="button" disabled={!!busy||(reply[request.id]||'').trim().length<3}
       onClick={()=>void decide(order,request,'REJECTED')}>Refuser</button>
     </div>
    </article>)}
   </div>
   {pendingRows.length===0&&<p>Aucune demande client à traiter.</p>}
   {pendingRows.length>50&&<p>Seules les 50 premières demandes sont affichées.</p>}
   {history.length>0&&<details style={{marginTop:18}}>
    <summary>Historique des décisions ({history.length})</summary>
    <ul>{history.slice(0,100).map(({order,request})=><li key={request.id}>
     {order.reference} · {request.type==='CANCEL'?'Annulation':'Retour'} · {request.status==='ACCEPTED'?'Acceptée':'Refusée'}
     · {request.reply||'Sans réponse affichable'}
    </li>)}</ul>
   </details>}
  </>}
 </section>;
}
