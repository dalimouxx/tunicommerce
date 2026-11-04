'use client';
import {useEffect,useState} from 'react';
import type {DispatchStatus} from '../../../modules/shops/dispatch-manifest';

type Summary={
 total:number;totalPages:number;page:number;pageSize:number;status:DispatchStatus;
 readyCount:number;shippedCount:number;error?:string
};
export default function ShopDispatchExports({shopId}:{shopId:string}){
 const base='/api/v1/shops/'+encodeURIComponent(shopId)+'/dispatch-manifest';
 const [status,setStatus]=useState<DispatchStatus>('ALL');
 const [page,setPage]=useState(1);
 const [summary,setSummary]=useState<Summary|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  const abort=new AbortController();
  setLoading(true);setError('');
  fetch(base+'?format=json&status='+status+'&page='+page,{cache:'no-store',signal:abort.signal})
   .then(async response=>{
    const body=await response.json() as Summary;
    if(!response.ok)throw new Error(body.error||'Liste des expéditions indisponible');
    if(!abort.signal.aborted)setSummary(body);
   })
   .catch(err=>{if(!abort.signal.aborted){setSummary(null);setError(err instanceof Error?err.message:'Erreur réseau');}})
   .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>abort.abort();
 },[base,page,status]);
 const download=base+'?status='+status+'&page='+page+'&format=csv';
 return <div style={{border:'1px solid #d6e3e9',borderRadius:12,padding:16,margin:'12px 0',background:'#f7fafb'}}>
  <h3 style={{margin:'0 0 8px'}}>Exports sécurisés des expéditions</h3>
  <p style={{margin:'0 0 12px'}}>Sélectionnez les commandes et téléchargez les lots de 100 maximum. Aucun colis n’est envoyé automatiquement.</p>
  <label>État des colis
   <select value={status} onChange={event=>{
    setStatus(event.target.value as DispatchStatus);setPage(1);
   }} style={{display:'block',padding:10,marginTop:5,borderRadius:8}}>
    <option value="ALL">Prêts et expédiés</option>
    <option value="READY">À remettre au transporteur</option>
    <option value="SHIPPED">Déjà expédiés</option>
   </select>
  </label>
  {loading&&<p role="status">Chargement du comptage…</p>}
  {error&&<p role="alert">{error}</p>}
  {summary&&!loading&&<>
   <p style={{margin:'12px 0'}}>Prêts : <strong>{summary.readyCount}</strong> · Expédiés : <strong>{summary.shippedCount}</strong></p>
   <p>{summary.total} commande(s) dans le filtre · page <strong>{summary.page}/{summary.totalPages}</strong></p>
   <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
    <button type="button" disabled={page<=1} onClick={()=>setPage(n=>n-1)}>Précédente</button>
    <button type="button" disabled={page>=summary.totalPages} onClick={()=>setPage(n=>n+1)}>Suivante</button>
    <a href={download} aria-label={'Exporter la page '+page+' des expéditions en CSV'}
     style={{padding:'10px 13px',background:'#126c65',color:'white',borderRadius:8,textDecoration:'none'}}>
     Télécharger CSV · page {page}
    </a>
   </div>
  </>}
  <p style={{fontSize:13,color:'#526176',margin:'14px 0 0'}}>
   Données privées (noms, téléphones, adresses) : ouvrir et transmettre uniquement aux personnes autorisées.
   Les tarifs, numéros de suivi et remises restent déclaratifs sans connexion API au transporteur.
  </p>
 </div>;
}
