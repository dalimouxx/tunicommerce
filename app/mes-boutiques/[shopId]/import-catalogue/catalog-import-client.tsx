'use client';
import {useRef,useState} from 'react';
import {parseCatalogCsv,type CatalogImportRow} from '../../../../modules/commerce/catalog-import';
export default function CatalogImportClient({shopId}:{shopId:string}){
 const [rows,setRows]=useState<CatalogImportRow[]>([]);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState('');
 const request=useRef<{body:string;requestId:string}|null>(null);
 async function readFile(file:File|undefined){
  setRows([]);setResult('');setNotice('');request.current=null;
  if(!file)return;
  try{
   if(file.size>120000)throw Error('Fichier limité à 120 Ko');
   const body=await file.text();
   const parsed=parseCatalogCsv(body);
   setRows(parsed);
   setNotice(parsed.length+' ligne(s) valides. Vérifiez le tableau avant de confirmer.');
  }catch(error){setNotice(error instanceof Error?error.message:'Fichier invalide');}
 }
 async function importNow(){
  if(!rows.length)return;
  if(!window.confirm('Importer '+rows.length+' produits dans cette boutique uniquement ? Le stock initial sera enregistré comme mouvement.'))return;
  const payload={rows},body=JSON.stringify(payload);
  const requestId=request.current?.body===body?request.current.requestId:crypto.randomUUID();
  request.current={body,requestId};
  setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/catalog-import',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'importProducts',requestId,payload})
   });
   const data=await response.json() as {error?:string;imported?:number;totalProducts?:number;alreadyApplied?:boolean};
   if(!response.ok)throw Error(data.error||'Import refusé');
   setResult((data.alreadyApplied?'Import déjà enregistré : ':'Import réussi : ')+data.imported+' produit(s). Catalogue total : '+data.totalProducts+'.');
   setRows([]);request.current=null;
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez avec le même fichier.');}
  finally{setBusy(false);}
 }
 return <section style={{padding:22,background:'white',border:'1px solid #dce5ec',borderRadius:16}}>
  <h2>Importer jusqu'à 100 produits en une opération</h2>
  <p>CSV séparé par des points-virgules, compatible avec Excel. Colonnes requises dans cet ordre :</p>
  <pre style={{overflowX:'auto',background:'#f4f7f9',padding:12}}>sku;name;category;variant;priceTnd;costTnd;stock;threshold</pre>
  <p>Les prix sont en dinars (exemple : 25,500 ou 25.500), les stocks sont des nombres entiers. Les doublons de SKU et les quotas SaaS sont vérifiés par le serveur ; l'import complet est annulé si une seule ligne est invalide.</p>
  <input aria-label="Fichier CSV de produits" type="file" accept=".csv,text/csv" disabled={busy}
   onChange={e=>void readFile(e.target.files?.[0])}/>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {result&&<p role="status">{result}</p>}
  {rows.length>0&&<>
   <p><strong>Prévisualisation : {rows.length} article(s)</strong></p>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
    <thead><tr><th>SKU</th><th>Produit</th><th>Variante</th><th>Prix</th><th>Coût</th><th>Stock</th></tr></thead>
    <tbody>{rows.slice(0,20).map((r,i)=><tr key={i} style={{borderTop:'1px solid #e1e8ed'}}>
     <td style={{padding:8}}>{r.sku}</td><td style={{padding:8}}>{r.name}</td>
     <td style={{padding:8}}>{r.variant}</td><td style={{padding:8}}>{(r.price/1000).toFixed(3)}</td>
     <td style={{padding:8}}>{(r.cost/1000).toFixed(3)}</td><td style={{padding:8}}>{r.stock}</td>
    </tr>)}</tbody></table></div>
   {rows.length>20&&<p>Affichage des 20 premières lignes avant confirmation.</p>}
   <button type="button" disabled={busy} onClick={()=>void importNow()} style={{background:'#126c65',color:'white',padding:'12px 18px',border:0,borderRadius:9}}>
    {busy?'Import en cours…':'Confirmer l’import du catalogue'}
   </button>
  </>}
 </section>;
}
