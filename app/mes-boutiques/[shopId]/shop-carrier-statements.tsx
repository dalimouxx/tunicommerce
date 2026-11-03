'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';

type Order={id:string;reference:string;carrier:string;grossMillimes:number;
 collectedMillimes:number;remainingMillimes:number;recordedSettlementsMillimes:number;
 declaredStatementsMillimes:number;declarationGapMillimes:number};
type Statement={id:string;orderReference:string;carrier:string;reference:string;amountMillimes:number;date:string};
type Data={orders?:Order[];statements?:Statement[];error?:string;alreadyApplied?:boolean};
const money=(n:number)=>(n/1000).toFixed(3);

export default function ShopCarrierStatements({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/carrier-statements';
 const [orders,setOrders]=useState<Order[]>([]);
 const [statements,setStatements]=useState<Statement[]>([]);
 const [orderId,setOrderId]=useState('');
 const [reference,setReference]=useState('');
 const [amount,setAmount]=useState('');
 const [date,setDate]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [notice,setNotice]=useState('');
 const pending=useRef<{body:string;id:string}|null>(null);
 const clear=()=>{pending.current=null;};
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const result=await response.json() as Data;
   if(!response.ok)throw Error(result.error||'Bordereaux indisponibles');
   if(!controller.signal.aborted){setOrders(result.orders||[]);setStatements(result.statements||[]);}
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const millimes=Math.round(Number(amount)*1000);
  if(!orders.some(o=>o.id===orderId)||!Number.isSafeInteger(millimes)||millimes<1||millimes>1_000_000_000){
   setNotice('Commande ou montant invalide.');return;
  }
  const payload={orderId,reference,amount:millimes,date};
  const raw=JSON.stringify(payload);
  const id=pending.current?.body===raw?pending.current.id:crypto.randomUUID();
  pending.current={id,body:raw};
  setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'recordCarrierStatement',requestId:id,payload})});
   const result=await response.json() as Data;
   if(!response.ok)throw Error(result.error||'Bordereau refusé');
   setOrders(result.orders||[]);setStatements(result.statements||[]);
   setReference('');setAmount('');setDate('');setOrderId('');clear();
   setNotice(result.alreadyApplied?'Document déjà enregistré : aucun doublon.':'Déclaration enregistrée. Aucun paiement n’a été créé.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez sans modifier les champs.');}
  finally{setBusy(false);}
 }
 return <section style={{background:'#fff',border:'1px solid #dfe6ed',borderRadius:18,padding:24,marginTop:16}}>
  <h2>Pré-rapprochement COD · Bordereaux transporteurs</h2>
  <p style={{color:'#566477'}}>Saisissez une référence et le montant déclaré par le transporteur pour une commande livrée. Les écarts comparent ces déclarations aux versements déjà enregistrés, sans prouver qu'un paiement bancaire a eu lieu. Cette opération ne modifie jamais le solde COD.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement des bordereaux…</p>:<>
   <form onSubmit={e=>void submit(e)} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',margin:'16px 0'}}>
    <label>Commande et transporteur<select required value={orderId} onChange={e=>{setOrderId(e.target.value);clear();}} style={{display:'block',padding:9}}>
     <option value="" disabled>Sélectionner une livraison</option>
     {orders.map(o=><option key={o.id} value={o.id}>{o.reference} · {o.carrier}</option>)}
    </select></label>
    <label>Référence du bordereau<input required maxLength={160} value={reference} onChange={e=>{setReference(e.target.value);clear();}} style={{display:'block',padding:9}}/></label>
    <label>Montant déclaré (TND)<input required type="number" min="0.001" max="1000000" step="0.001" value={amount} onChange={e=>{setAmount(e.target.value);clear();}} style={{display:'block',padding:9,width:145}}/></label>
    <label>Date du bordereau<input required type="date" value={date} onChange={e=>{setDate(e.target.value);clear();}} style={{display:'block',padding:9}}/></label>
    <button type="submit" disabled={busy||!orderId} style={{padding:12}}>Ajouter le justificatif déclaré</button>
   </form>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
    <thead><tr><th>Commande</th><th>Transporteur</th><th>COD restant</th><th>Montants déclarés</th><th>Versements enregistrés</th><th>Écart déclaratif</th></tr></thead>
    <tbody>{orders.map(o=><tr key={o.id} style={{borderTop:'1px solid #dfe6ed'}}>
     <td style={{padding:8}}>{o.reference}</td><td style={{padding:8}}>{o.carrier}</td>
     <td style={{padding:8}}>{money(o.remainingMillimes)} TND</td>
     <td style={{padding:8}}>{money(o.declaredStatementsMillimes)} TND</td>
     <td style={{padding:8}}>{money(o.recordedSettlementsMillimes)} TND</td>
     <td style={{padding:8}}><strong>{money(o.declarationGapMillimes)} TND</strong></td>
    </tr>)}</tbody></table>
    {orders.length===0&&<p>Aucune commande livrée avec transporteur déclaré.</p>}
   </div>
   <h3>Références de bordereaux enregistrées</h3>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
    <thead><tr><th>Référence</th><th>Commande</th><th>Transporteur</th><th>Date</th><th>Montant</th></tr></thead>
    <tbody>{statements.map(statement=><tr key={statement.id} style={{borderTop:'1px solid #dfe6ed'}}>
     <td style={{padding:8}}>{statement.reference}</td><td style={{padding:8}}>{statement.orderReference}</td>
     <td style={{padding:8}}>{statement.carrier}</td><td style={{padding:8}}>{statement.date}</td>
     <td style={{padding:8}}>{money(statement.amountMillimes)} TND</td>
    </tr>)}</tbody></table>{statements.length===0&&<p>Aucun bordereau déclaré.</p>}</div>
  </>}
 </section>;
}
