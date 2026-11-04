'use client';
import {useEffect,useState} from 'react';
import type {CodAuditFilter} from '../../../modules/shops/cod-exceptions';

type Summary={page:number;pageSize:number;total:number;totalPages:number;
 filter:CodAuditFilter;attentionCount:number;cleanCount:number;error?:string};

/** No payment write, bank verification, or PII in the summary response. */
export default function ShopCodAuditExport({shopId}:{shopId:string}){
 const base='/api/v1/shops/'+encodeURIComponent(shopId)+'/cod-exceptions';
 const [filter,setFilter]=useState<CodAuditFilter>('ALL');
 const [page,setPage]=useState(1);
 const [summary,setSummary]=useState<Summary|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  fetch(base+'?format=json&filter='+filter+'&page='+page,{cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const body=await response.json() as Summary;
    if(!response.ok)throw Error(body.error||'Audit COD indisponible');
    if(!controller.signal.aborted)setSummary(body);
   })
   .catch(err=>{if(!controller.signal.aborted){setSummary(null);setError(err instanceof Error?err.message:'Erreur réseau');}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[base,filter,page]);
 return <div style={{border:'1px solid #dce5eb',padding:16,borderRadius:12,background:'#f7fafb',margin:'12px 0'}}>
  <h3>Export COD sans limite silencieuse à 1 000 commandes</h3>
  <p>Chaque fichier contient au maximum 100 commandes livrées de cette boutique. Les montants proviennent des saisies internes et ne sont pas des confirmations bancaires.</p>
  <label>Affichage
   <select aria-label="Filtrer les écarts COD" value={filter} onChange={event=>{setFilter(event.target.value as CodAuditFilter);setPage(1);}}
    style={{display:'block',padding:9,marginTop:5}}>
    <option value="ALL">Toutes les livraisons</option>
    <option value="ATTENTION">Écarts à vérifier</option>
    <option value="CLEAN">Sans écart détecté</option>
   </select>
  </label>
  {loading&&<p role="status">Chargement des compteurs…</p>}
  {error&&<p role="alert">{error}</p>}
  {summary&&!loading&&<>
   <p>Écarts : <strong>{summary.attentionCount}</strong> · Sans écart : <strong>{summary.cleanCount}</strong></p>
   <p>{summary.total} commande(s) dans ce filtre, page {summary.page}/{summary.totalPages}</p>
   <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
    <button type="button" disabled={page<=1} onClick={()=>setPage(n=>n-1)}>Précédente</button>
    <button type="button" disabled={page>=summary.totalPages} onClick={()=>setPage(n=>n+1)}>Suivante</button>
    <a href={base+'?filter='+filter+'&page='+page+'&format=csv'}
     style={{padding:'10px 13px',background:'#126c65',color:'white',borderRadius:9,textDecoration:'none'}}>
     Télécharger CSV · page {page}
    </a>
   </div>
  </>}
  <p style={{fontSize:13,color:'#526176'}}>Rapport privé : vérifiez les justificatifs réels, sans confondre déclaration et encaissement certifié.</p>
 </div>;
}
