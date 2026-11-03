'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';

type Item={productId:string;name:string;quantity:number;returned:number};
type Order={id:string;reference:string;items:Item[]};
type Return={id:string;reference:string;orderId:string;quantity:number;credit:number;refunded:number;condition:string;reason:string;createdAt:string};
type Data={orders?:Order[];returns?:Return[];error?:string;alreadyApplied?:boolean};
const money=(millimes:number)=>(millimes/1000).toFixed(3);

export default function ShopReturns({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/returns';
 const [orders,setOrders]=useState<Order[]>([]);
 const [returns,setReturns]=useState<Return[]>([]);
 const [orderId,setOrderId]=useState('');
 const [productId,setProductId]=useState('');
 const [quantity,setQuantity]=useState('1');
 const [reason,setReason]=useState('');
 const [condition,setCondition]=useState<'RESELLABLE'|'DAMAGED'>('DAMAGED');
 const [returnCost,setReturnCost]=useState('0');
 const [refundId,setRefundId]=useState('');
 const [refundAmount,setRefundAmount]=useState('');
 const [refundReference,setRefundReference]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [notice,setNotice]=useState('');
 const pending=useRef<{id:string;body:string}|null>(null);
 const order=orders.find(o=>o.id===orderId);
 const availableItems=order?.items.filter(i=>i.quantity>i.returned)||[];
 const selectedItem=availableItems.find(i=>i.productId===productId);
 const refundable=returns.filter(r=>r.credit>r.refunded);
 const selectedRefund=refundable.find(r=>r.id===refundId);
 const clearRequest=()=>{pending.current=null;};
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const result=await response.json() as Data;
   if(!response.ok)throw Error(result.error||'Retours indisponibles');
   if(!controller.signal.aborted){setOrders(result.orders||[]);setReturns(result.returns||[]);}
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
  .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url]);
 async function mutate(action:'receiveReturn'|'refundReturn',payload:unknown){
  const raw=JSON.stringify({action,payload});
  const id=pending.current?.body===raw?pending.current.id:crypto.randomUUID();
  pending.current={body:raw,id};
  setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,payload,requestId:id})});
   const result=await response.json() as Data;
   if(!response.ok)throw Error(result.error||'Opération refusée');
   setOrders(result.orders||[]);setReturns(result.returns||[]);
   clearRequest();
   setNotice(result.alreadyApplied?'Opération déjà enregistrée : aucun doublon créé.':'Opération enregistrée pour cette boutique.');
   return true;
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez sans modifier les champs.');return false;}
  finally{setBusy(false);}
 }
 async function receive(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const count=Number(quantity),cost=Math.round(Number(returnCost)*1000);
  if(!selectedItem||!Number.isSafeInteger(count)||count<1||count>selectedItem.quantity-selectedItem.returned||
   !Number.isSafeInteger(cost)||cost<0||cost>1_000_000){
   setNotice('Quantité retournée ou coût de retour invalide.');return;
  }
  const ok=await mutate('receiveReturn',{orderId,productId,quantity:count,reason,condition,returnCost:cost});
  if(ok){setOrderId('');setProductId('');setQuantity('1');setReason('');setReturnCost('0');}
 }
 async function refund(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const amount=Math.round(Number(refundAmount)*1000);
  if(!selectedRefund||!Number.isSafeInteger(amount)||amount<=0||amount>selectedRefund.credit-selectedRefund.refunded){
   setNotice('Remboursement supérieur au crédit disponible.');return;
  }
  if(!window.confirm('Confirmer l’enregistrement d’un remboursement effectivement effectué ?'))return;
  const ok=await mutate('refundReturn',{id:refundId,amount,reference:refundReference});
  if(ok){setRefundId('');setRefundAmount('');setRefundReference('');}
 }
 return <section style={{background:'#fff',border:'1px solid #dfe6ed',borderRadius:18,padding:24,marginTop:16}}>
  <h2>Retours et remboursements · Boutique indépendante</h2>
  <p>Retour d'un article livré, remise éventuelle en stock et avoir calculé. Les remboursements sont enregistrés uniquement après leur exécution réelle ; l'application n'envoie pas d'argent.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement des retours…</p>:<>
   <form onSubmit={e=>void receive(e)} style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'end',margin:'18px 0'}}>
    <label>Commande livrée<select required value={orderId} onChange={e=>{setOrderId(e.target.value);setProductId('');clearRequest();}} style={{display:'block',padding:9}}>
     <option value="" disabled>Sélectionner</option>{orders.filter(o=>o.items.some(i=>i.quantity>i.returned)).map(o=><option key={o.id} value={o.id}>{o.reference}</option>)}
    </select></label>
    <label>Article<select required value={productId} onChange={e=>{setProductId(e.target.value);clearRequest();}} style={{display:'block',padding:9}}>
     <option value="" disabled>Choisir un article</option>{availableItems.map(i=><option key={i.productId} value={i.productId}>{i.name} · {i.quantity-i.returned} restant(s)</option>)}
    </select></label>
    <label>Quantité<input required type="number" min="1" max={selectedItem?selectedItem.quantity-selectedItem.returned:1} step="1" value={quantity} onChange={e=>{setQuantity(e.target.value);clearRequest();}} style={{display:'block',padding:9,width:85}}/></label>
    <label>Motif<input required minLength={3} maxLength={500} value={reason} onChange={e=>{setReason(e.target.value);clearRequest();}} style={{display:'block',padding:9}}/></label>
    <label>État<select value={condition} onChange={e=>{setCondition(e.target.value as 'RESELLABLE'|'DAMAGED');clearRequest();}} style={{display:'block',padding:9}}>
     <option value="DAMAGED">Non revendable</option><option value="RESELLABLE">Revendable (remise en stock)</option>
    </select></label>
    <label>Coût du retour (TND)<input required type="number" min="0" max="1000" step="0.001" value={returnCost} onChange={e=>{setReturnCost(e.target.value);clearRequest();}} style={{display:'block',padding:9,width:105}}/></label>
    <button type="submit" disabled={busy||!selectedItem} style={{padding:12}}>Enregistrer le retour</button>
   </form>
   <h3>Remboursement partiel d'un avoir</h3>
   <form onSubmit={e=>void refund(e)} style={{display:'flex',alignItems:'end',flexWrap:'wrap',gap:10,margin:'14px 0'}}>
    <label>Avoir<select required value={refundId} onChange={e=>{setRefundId(e.target.value);clearRequest();}} style={{display:'block',padding:9}}>
     <option value="" disabled>Sélectionner</option>{refundable.map(r=><option key={r.id} value={r.id}>{r.reference} · restant {money(r.credit-r.refunded)} TND</option>)}
    </select></label>
    <label>Montant remboursé (TND)<input required type="number" min="0.001" step="0.001" max={selectedRefund?money(selectedRefund.credit-selectedRefund.refunded):undefined} value={refundAmount} onChange={e=>{setRefundAmount(e.target.value);clearRequest();}} style={{display:'block',padding:9,width:135}}/></label>
    <label>Référence justificative<input required maxLength={160} value={refundReference} onChange={e=>{setRefundReference(e.target.value);clearRequest();}} style={{display:'block',padding:9}}/></label>
    <button type="submit" disabled={busy||!selectedRefund} style={{padding:12}}>Enregistrer le remboursement</button>
   </form>
   <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',textAlign:'left'}}>
    <thead><tr><th>Avoir</th><th>Motif</th><th>Quantité</th><th>Crédit</th><th>Remboursé</th><th>Solde</th></tr></thead>
    <tbody>{returns.map(r=><tr key={r.id} style={{borderTop:'1px solid #dfe6ed'}}>
     <td style={{padding:8}}>{r.reference}</td><td style={{padding:8}}>{r.reason}</td>
     <td style={{padding:8}}>{r.quantity}</td><td style={{padding:8}}>{money(r.credit)} TND</td>
     <td style={{padding:8}}>{money(r.refunded)} TND</td><td style={{padding:8}}>{money(r.credit-r.refunded)} TND</td>
    </tr>)}</tbody></table>{returns.length===0&&<p>Aucun retour enregistré.</p>}</div>
  </>}
 </section>;
}
