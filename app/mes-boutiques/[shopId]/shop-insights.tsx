'use client';
import {useEffect,useState} from 'react';
import {merchantWorkspaceHash,type MerchantWorkspaceTab} from '../../../modules/shops/workspace-tabs';
type Insight={id:string;title:string;description:string;priority:'high'|'medium'|'info';metric:number;unit:string;targetTab:MerchantWorkspaceTab;actionLabel:string};
type Result={generatedAt?:string;mode?:string;insights?:Insight[];summary?:{
 ordersLast30Days:number;cancellationRatePercent:number;awaitingConfirmation:number;
 overdueCallbacks:number;lowStockProducts:number;outstandingCodMillimes:number;estimatedMarginMillimes:number;
 pendingCustomerRequests:number;missingHandoffs:number;refundsDueMillimes:number;
};error?:string};
const tnd=(value:number)=>(value/1000).toFixed(3);
export default function ShopInsights({shopId}:{shopId:string}){
 const [result,setResult]=useState<Result|null>(null);
 const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/insights',{cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const data=await response.json() as Result;
    if(!response.ok)throw Error(data.error||'Rapport indisponible');
    if(!controller.signal.aborted)setResult(data);
   }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Erreur réseau');})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[shopId]);
 return <section style={{padding:24,border:'1px solid #d7e4e8',background:'#fff',borderRadius:16,marginTop:16}}>
  <h2>Assistant d'analyse commerciale · Pré-Copilot</h2>
  <p>Recommandations explicables calculées à partir des données de cette boutique. Il s'agit d'un moteur de règles local, <strong>pas d'une intelligence artificielle générative</strong>, ni d'une prévision garantie de bénéfice ou de fraude.</p>
  {notice&&<p role="alert">{notice}</p>}
  {loading?<p>Analyse des indicateurs…</p>:result&&<>
   {result.summary&&<div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'14px 0'}}>
    <p><strong>{result.summary.ordersLast30Days}</strong> commandes en 30 jours</p>
    <p><strong>{result.summary.awaitingConfirmation}</strong> confirmations en attente</p>
    <p><strong>{result.summary.cancellationRatePercent}%</strong> annulations</p>
    <p><strong>{result.summary.pendingCustomerRequests}</strong> demande(s) client en attente</p>
    <p><strong>{result.summary.missingHandoffs}</strong> colis sans bon déclaré</p>
    <p><strong>{tnd(result.summary.outstandingCodMillimes)} TND</strong> COD non enregistré</p>
    <p><strong>{tnd(result.summary.estimatedMarginMillimes)} TND</strong> marge opérationnelle estimée</p>
   </div>}
   <div style={{display:'grid',gap:10}}>
    {(result.insights||[]).map(item=><article key={item.id} style={{
     padding:15,border:'1px solid #dfe6ee',borderRadius:11,
     borderLeft:'4px solid '+(item.priority==='high'?'#9a5736':item.priority==='medium'?'#a47b28':'#126c65')
    }}>
     <strong>{item.title}</strong><p>{item.description}</p>
     <small>Indicateur : {item.unit==='millimes'?tnd(item.metric)+' TND':item.metric+' '+item.unit}</small>
     <p><a href={merchantWorkspaceHash(item.targetTab)} style={{fontWeight:700,color:'#126c65',textDecoration:'underline'}}>{item.actionLabel}</a></p>
    </article>)}
   </div>
   <p style={{fontSize:12,color:'#657585'}}>Analyses sur cette boutique uniquement, sans contact externe ni transmission de ses commandes à un modèle tiers.</p>
  </>}
 </section>;
}
