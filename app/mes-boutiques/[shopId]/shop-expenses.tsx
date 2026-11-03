'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';

type Expense={id:string;label:string;category:string;amount:number;date:string};
const toTnd=(millimes:number)=>(millimes/1000).toFixed(3);
export default function ShopExpenses({shopId}:{shopId:string}){
 const [expenses,setExpenses]=useState<Expense[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [label,setLabel]=useState('');
 const [category,setCategory]=useState('Fonctionnement');
 const [amount,setAmount]=useState('');
 const [date,setDate]=useState('');
 const requestId=useRef<string|null>(null);
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/expenses';

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setNotice('');setExpenses([]);
  fetch(url,{cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const body=await response.json() as {expenses?:Expense[];error?:string};
    if(!response.ok)throw new Error(body.error||'Dépenses indisponibles');
    setExpenses(body.expenses||[]);
   }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url]);

 async function addExpense(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const millimes=Math.round(Number(amount)*1000);
  if(!Number.isSafeInteger(millimes)||millimes<=0||millimes>1_000_000_000){
   setNotice('Montant invalide');return;
  }
  if(!date){setNotice('Indiquez la date de la dépense');return;}
  const id=requestId.current||crypto.randomUUID();
  requestId.current=id;
  setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'expense',requestId:id,payload:{label,category,amount:millimes,date}})});
   const result=await response.json() as {expenses?:Expense[];error?:string;alreadyApplied?:boolean};
   if(!response.ok)throw new Error(result.error||'Enregistrement impossible');
   setExpenses(result.expenses||[]);
   requestId.current=null;
   setLabel('');setAmount('');
   setNotice(result.alreadyApplied?'Dépense déjà enregistrée : aucun doublon créé.':'Dépense enregistrée pour cette boutique.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez sans modifier les champs.');}
  finally{setBusy(false);}
 }
 return <section style={{background:'#fff',border:'1px solid #e0e6ee',borderRadius:18,padding:24,marginTop:16}}>
  <h2>Dépenses de cette boutique</h2>
  <p style={{color:'#566477'}}>Enregistrement privé du propriétaire avec historique. Montants en TND, sans modification des commandes ni des encaissements COD.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement des dépenses…</p>:<>
   <form onSubmit={e=>void addExpense(e)} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',margin:'18px 0'}}>
    <label>Libellé<input required maxLength={160} value={label} onChange={e=>{setLabel(e.target.value);requestId.current=null;}} style={{display:'block',padding:10}}/></label>
    <label>Catégorie<select value={category} onChange={e=>{setCategory(e.target.value);requestId.current=null;}} style={{display:'block',padding:10}}>{['Fonctionnement','Publicité','Emballage','Transport','Autre'].map(item=><option key={item}>{item}</option>)}</select></label>
    <label>Montant (TND)<input required type="number" min="0.001" max="1000000" step="0.001" value={amount} onChange={e=>{setAmount(e.target.value);requestId.current=null;}} style={{display:'block',padding:10,width:145}}/></label>
    <label>Date<input required type="date" value={date} onChange={e=>{setDate(e.target.value);requestId.current=null;}} style={{display:'block',padding:10}}/></label>
    <button type="submit" disabled={busy} style={{padding:'12px 16px',border:0,borderRadius:10,background:'#126c65',color:'white',fontWeight:700}}>Enregistrer la dépense</button>
   </form>
   <p>Montant enregistré : {toTnd(expenses.reduce((sum,e)=>sum+e.amount,0))} TND (sur les {expenses.length} dernières lignes affichées)</p>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
    <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Montant</th></tr></thead>
    <tbody>{expenses.map(expense=><tr key={expense.id} style={{borderTop:'1px solid #e0e6ee'}}>
     <td style={{padding:10}}>{expense.date}</td><td style={{padding:10}}>{expense.label}</td><td style={{padding:10}}>{expense.category}</td><td style={{padding:10}}>{toTnd(expense.amount)} TND</td>
    </tr>)}</tbody>
   </table>{!expenses.length&&<p>Aucune dépense enregistrée.</p>}</div>
  </>}
 </section>;
}
