'use client';
import {useEffect,useRef,useState} from 'react';

type Row={id:string;reference:string;carrier:string;tracking:string};
type Receipt={id:string;orderReference:string;carrier:string;tracking:string;proofReference:string;at:string};
type Response={pending?:Row[];receipts?:Receipt[];pendingCount?:number;totalRecorded?:number;pendingPage?:number;receiptsPage?:number;pendingTotalPages?:number;receiptsTotalPages?:number;alreadyApplied?:boolean;error?:string};

export default function ShopCarrierHandoffs({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/carrier-handoffs';
 const [pending,setPending]=useState<Row[]>([]);
 const [receipts,setReceipts]=useState<Receipt[]>([]);
 const [proofs,setProofs]=useState<Record<string,string>>({});
 const [count,setCount]=useState(0);
 const [totalRecorded,setTotalRecorded]=useState(0);
 const [pendingPage,setPendingPage]=useState(1);
 const [receiptsPage,setReceiptsPage]=useState(1);
 const [pendingTotalPages,setPendingTotalPages]=useState(1);
 const [receiptsTotalPages,setReceiptsTotalPages]=useState(1);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState('');
 const [loading,setLoading]=useState(true);
 const keys=useRef<Record<string,{requestId:string;proof:string}>>({});
 useEffect(()=>{
  const controller=new AbortController();
  const paged=url+'?pendingPage='+pendingPage+'&receiptsPage='+receiptsPage;
  fetch(paged,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json() as Response;
   if(!response.ok)throw Error(data.error||'Remises indisponibles');
   if(!controller.signal.aborted){setPending(data.pending||[]);setReceipts(data.receipts||[]);setCount(data.pendingCount||0);setTotalRecorded(data.totalRecorded||0);setPendingTotalPages(data.pendingTotalPages||1);setReceiptsTotalPages(data.receiptsTotalPages||1);setPendingPage(1);setReceiptsPage(1);setTotalRecorded(data.totalRecorded||0);setPendingTotalPages(data.pendingTotalPages||1);setReceiptsTotalPages(data.receiptsTotalPages||1);}
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url,pendingPage,receiptsPage]);
 async function record(order:Row){
  const proofReference=(proofs[order.id]||'').trim();
  if(proofReference.length<6){setNotice('Référence du bon de remise requise (6 caractères minimum).');return;}
  if(!window.confirm('Confirmer que le colis '+order.reference+' a été remis au transporteur indiqué ? Cette déclaration ne confirme ni une livraison finale ni un règlement COD.'))return;
  const existing=keys.current[order.id];
  const requestId=existing?.proof===proofReference?existing.requestId:crypto.randomUUID();
  keys.current[order.id]={proof:proofReference,requestId};
  setBusy(order.id);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'recordCarrierHandoff',requestId,payload:{orderId:order.id,proofReference}})});
   const data=await response.json() as Response;
   if(!response.ok)throw Error(data.error||'Remise refusée');
   setPending(data.pending||[]);setReceipts(data.receipts||[]);setCount(data.pendingCount||0);
   delete keys.current[order.id];
   setNotice(data.alreadyApplied?'La remise avait déjà été enregistrée.':
    'Remise déclarée avec référence et historique. Aucun statut de livraison ni paiement n’a été modifié.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez avec la même référence.');}
  finally{setBusy('');}
 }
 return <section style={{background:'white',border:'1px solid #dce6ec',borderRadius:16,padding:22,marginTop:16}}>
  <h2>Remise physique des colis · Registre</h2>
  <p>Déclarez la remise au transporteur uniquement lorsqu'elle a réellement eu lieu. La référence du bon reste dans l'historique ; ce n'est ni une confirmation API du transporteur, ni une preuve d'encaissement COD.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement…</p>:<>
   <p><strong>{count}</strong> colis expédié(s) sans déclaration de remise · <strong>{totalRecorded}</strong> bon(s) enregistrés.</p>
   <nav aria-label="Pages des remises en attente" style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',margin:'12px 0'}}>
    <button type="button" disabled={pendingPage===1||!!busy} onClick={()=>setPendingPage(n=>Math.max(1,n-1))}>Colis précédents</button>
    <span>Colis en attente · page {pendingPage}/{pendingTotalPages}</span>
    <button type="button" disabled={pendingPage>=pendingTotalPages||!!busy} onClick={()=>setPendingPage(n=>Math.min(n+1,pendingTotalPages))}>Colis suivants</button>
   </nav>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
    <thead><tr><th>Commande</th><th>Transporteur</th><th>Numéro de suivi</th><th>Bon de remise</th></tr></thead>
    <tbody>{pending.map(order=><tr key={order.id} style={{borderTop:'1px solid #e2e7eb'}}>
     <td style={{padding:8}}>{order.reference}</td><td style={{padding:8}}>{order.carrier}</td>
     <td style={{padding:8}}>{order.tracking}</td>
     <td style={{padding:8}}><input aria-label={'Bon de remise '+order.reference} maxLength={160}
      placeholder="Référence du bon signé" value={proofs[order.id]||''}
      onChange={event=>{setProofs(x=>({...x,[order.id]:event.target.value}));delete keys.current[order.id];}}/>
      <button type="button" disabled={!!busy||(proofs[order.id]||'').trim().length<6}
       onClick={()=>void record(order)}>Déclarer la remise</button></td>
    </tr>)}</tbody></table></div>
   {count===0&&<p>Aucune remise en attente sur les commandes actuellement expédiées.</p>}
   {count>40&&<p>Utilisez les pages de colis pour consulter l'ensemble des remises à effectuer.</p>}
   <h3>Historique des bons</h3>
   <nav aria-label="Pages des bons de remise" style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',margin:'12px 0'}}>
    <button type="button" disabled={receiptsPage===1||!!busy} onClick={()=>setReceiptsPage(n=>Math.max(1,n-1))}>Bons précédents</button>
    <span>Historique · page {receiptsPage}/{receiptsTotalPages}</span>
    <button type="button" disabled={receiptsPage>=receiptsTotalPages||!!busy} onClick={()=>setReceiptsPage(n=>Math.min(n+1,receiptsTotalPages))}>Bons suivants</button>
   </nav>

   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
    <thead><tr><th>Commande</th><th>Transporteur</th><th>Bon</th><th>Date d'enregistrement</th></tr></thead>
    <tbody>{receipts.map(receipt=><tr key={receipt.id} style={{borderTop:'1px solid #e2e7eb'}}>
     <td style={{padding:8}}>{receipt.orderReference}</td><td style={{padding:8}}>{receipt.carrier}</td>
     <td style={{padding:8}}>{receipt.proofReference}</td>
     <td style={{padding:8}}>{new Date(receipt.at).toLocaleString('fr-TN')}</td>
    </tr>)}</tbody></table></div>
  </>}
 </section>;
}
