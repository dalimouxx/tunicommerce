'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import ShopCodAuditExport from './shop-cod-audit-export';

type Statement={id:string;orderId:string;orderReference:string;reference:string;
 amountMillimes:number;manuallyMatched:boolean;proofReference:string|null};
type Settlement={id:string;orderId:string;reference:string;amountMillimes:number;manuallyMatched:boolean};
type Summary={manuallyMatchedStatements:number;pendingStatements:number;pendingSettlements:number};
type Data={statements?:Statement[];settlements?:Settlement[];summary?:Summary;error?:string;alreadyApplied?:boolean};
const tnd=(n:number)=>(n/1000).toFixed(3);

export default function ShopCodMatching({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/carrier-statements';
 const [statements,setStatements]=useState<Statement[]>([]);
 const [settlements,setSettlements]=useState<Settlement[]>([]);
 const [summary,setSummary]=useState<Summary|null>(null);
 const [statementId,setStatementId]=useState('');
 const [settlementId,setSettlementId]=useState('');
 const [proofReference,setProofReference]=useState('');
 const [acknowledge,setAcknowledge]=useState(false);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const pending=useRef<{key:string;id:string}|null>(null);
 const selected=statements.find(s=>s.id===statementId&&!s.manuallyMatched);
 const available=selected?settlements.filter(x=>!x.manuallyMatched&&
  x.orderId===selected.orderId&&x.amountMillimes===selected.amountMillimes):[];
 function apply(data:Data){
  setStatements(data.statements||[]);setSettlements(data.settlements||[]);setSummary(data.summary||null);
 }
 async function refresh(){
  setLoading(true);setNotice('');
  try{
   const response=await fetch(url,{cache:'no-store'});
   const data=await response.json() as Data;
   if(!response.ok)throw Error(data.error||'Données indisponibles');
   apply(data);
  }catch(error){setNotice(error instanceof Error?error.message:'Chargement impossible');}
  finally{setLoading(false);}
 }
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json() as Data;
   if(!response.ok)throw Error(data.error||'Rapprochements indisponibles');
   if(!controller.signal.aborted)apply(data);
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!selected||!available.some(s=>s.id===settlementId)||!acknowledge)return;
  const payload={statementId,settlementId,proofReference};
  const key=JSON.stringify(payload);
  const id=pending.current?.key===key?pending.current.id:crypto.randomUUID();
  pending.current={key,id};
  setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'reconcileCarrierStatement',requestId:id,payload})});
   const data=await response.json() as Data;
   if(!response.ok)throw Error(data.error||'Rapprochement refusé');
   apply(data);pending.current=null;setStatementId('');setSettlementId('');setProofReference('');setAcknowledge(false);
   setNotice(data.alreadyApplied?'Rapprochement déjà enregistré, sans doublon.':
    'Rapprochement manuel enregistré. Aucun encaissement supplémentaire n’a été créé.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau : réessayez sans modifier les références.');}
  finally{setBusy(false);}
 }
 return <section style={{background:'white',border:'1px solid #d5e2e9',borderRadius:16,padding:24,marginTop:16}}>
  <h2>Rapprochement COD manuel · Contrôle croisé</h2>
  <ShopCodAuditExport shopId={shopId}/>
  <p style={{fontSize:13,color:'#536579'}}>Export privé, réservé au propriétaire de cette boutique. Les dates reposent sur la dernière transition de statut enregistrée ; les montants ne constituent pas une certification bancaire ou comptable.</p>
  <p>Associez un bordereau du transporteur à un versement COD déjà enregistré <strong>pour la même commande et le même montant</strong>.
   Chaque document n'est rapprochable qu'une fois. Cette opération est un contrôle administratif : elle ne certifie pas que la banque a reçu des fonds et n'augmente jamais le COD encaissé.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement…</p>:<>
   <p>{summary?.manuallyMatchedStatements||0} association(s) enregistrée(s) · {summary?.pendingStatements||0} bordereau(x) sans rapprochement · {summary?.pendingSettlements||0} versement(s) non rapproché(s).</p>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Actualiser les écritures</button>
   <form onSubmit={event=>void submit(event)} style={{display:'grid',gap:10,maxWidth:620,marginTop:16}}>
    <label>Bordereau déclaré non rapproché
     <select required value={statementId} onChange={e=>{setStatementId(e.target.value);setSettlementId('');pending.current=null;}} style={{display:'block',padding:10,width:'100%'}}>
      <option value="" disabled>Choisir un bordereau</option>
      {statements.filter(s=>!s.manuallyMatched).map(s=><option key={s.id} value={s.id}>{s.orderReference} · {s.reference} · {tnd(s.amountMillimes)} TND</option>)}
     </select>
    </label>
    <label>Versement déjà enregistré (même commande et même montant)
     <select required value={settlementId} onChange={e=>{setSettlementId(e.target.value);pending.current=null;}} style={{display:'block',padding:10,width:'100%'}}>
      <option value="" disabled>Choisir une écriture correspondante</option>
      {available.map(s=><option key={s.id} value={s.id}>{s.reference} · {tnd(s.amountMillimes)} TND</option>)}
     </select>
    </label>
    {selected&&available.length===0&&<p role="alert">Aucun versement du même montant n'est disponible pour cette commande. Vérifiez les écarts avant de poursuivre.</p>}
    <label>Référence du justificatif vérifié manuellement
     <input required minLength={6} maxLength={160} value={proofReference} onChange={e=>{setProofReference(e.target.value);pending.current=null;}}
      style={{display:'block',padding:10,width:'100%'}} placeholder="Référence de relevé / bordereau externe"/>
    </label>
    <label><input type="checkbox" checked={acknowledge} onChange={e=>setAcknowledge(e.target.checked)}/>
     J'ai comparé les références avec les justificatifs disponibles. Je comprends qu'il ne s'agit pas d'une vérification bancaire automatique.
    </label>
    <button type="submit" disabled={busy||!selected||!available.some(x=>x.id===settlementId)||!acknowledge} style={{padding:12}}>Enregistrer le rapprochement manuel</button>
   </form>
   <h3>Historique des rapprochements</h3>
   <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',textAlign:'left'}}>
    <thead><tr><th>Commande</th><th>Bordereau</th><th>Montant</th><th>État</th><th>Référence du contrôle</th></tr></thead>
    <tbody>{statements.map(s=><tr key={s.id} style={{borderTop:'1px solid #e1e8ed'}}>
     <td style={{padding:9}}>{s.orderReference}</td><td style={{padding:9}}>{s.reference}</td>
     <td style={{padding:9}}>{tnd(s.amountMillimes)} TND</td>
     <td style={{padding:9}}>{s.manuallyMatched?'Associé manuellement':'À rapprocher'}</td>
     <td style={{padding:9}}>{s.proofReference||'—'}</td>
    </tr>)}</tbody>
   </table></div>
  </>}
 </section>;
}
