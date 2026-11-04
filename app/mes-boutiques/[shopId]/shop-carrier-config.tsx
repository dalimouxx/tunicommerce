'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {governors,type Carrier} from '../../../modules/commerce/types';

const tnd=(n:number)=>(n/1000).toFixed(3);
const millimes=(s:string)=>Math.round(Number(s)*1000);
export default function ShopCarrierConfig({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/carriers';
 const [carriers,setCarriers]=useState<Carrier[]>([]);
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [areas,setAreas]=useState<string[]>([]);
 const [delivery,setDelivery]=useState('5.000');
 const [returns,setReturns]=useState('3.000');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true);
 const pending=useRef<{key:string;requestId:string}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const result=await response.json() as {carriers?:Carrier[];error?:string};
   if(!response.ok)throw Error(result.error||'Transporteurs indisponibles');
   if(!controller.signal.aborted)setCarriers(result.carriers||[]);
  }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Chargement impossible');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url]);
 async function mutate(payload:Omit<Carrier,'id'>&{id?:string}){
  const key=JSON.stringify(payload),requestId=pending.current?.key===key?pending.current.requestId:crypto.randomUUID();
  pending.current={key,requestId};setBusy(true);setNotice('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'saveCarrier',requestId,payload})});
   const result=await response.json() as {carriers?:Carrier[];error?:string};
   if(!response.ok)throw Error(result.error||'Enregistrement refusé');
   setCarriers(result.carriers||[]);pending.current=null;
   setNotice('Configuration enregistrée dans cette boutique. Aucun transporteur externe n’est contacté.');
   return true;
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez avec les mêmes données.');return false;}
  finally{setBusy(false);}
 }
 async function add(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const deliveryCost=millimes(delivery),returnCost=millimes(returns);
  if(!areas.length||!Number.isSafeInteger(deliveryCost)||deliveryCost<0||!Number.isSafeInteger(returnCost)||returnCost<0){
   setNotice('Choisissez des gouvernorats et des montants valides.');return;
  }
  if(await mutate({name,phone,governorates:areas,deliveryCost,returnCost,active:true})){
   setName('');setPhone('');setAreas([]);
  }
 }
 return <section style={{padding:22,border:'1px solid #dce7ec',borderRadius:16,background:'white',marginTop:16}}>
  <h2>Transporteurs et zones de couverture</h2>
  <p>Configurez vos partenaires et leurs frais aller/retour par gouvernorat. Ces tarifs sont déclaratifs : aucune API de transporteur n'est connectée et aucune étiquette officielle n'est achetée.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement…</p>:<>
   <form onSubmit={e=>void add(e)} style={{display:'grid',gap:10,margin:'14px 0'}}>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
     <label>Transporteur<input required maxLength={120} value={name} onChange={e=>{setName(e.target.value);pending.current=null;}} style={{display:'block',padding:9}}/></label>
     <label>Téléphone professionnel<input maxLength={30} value={phone} onChange={e=>{setPhone(e.target.value);pending.current=null;}} style={{display:'block',padding:9}}/></label>
     <label>Frais aller (TND)<input required type="number" min="0" max="10000" step="0.001" value={delivery} onChange={e=>{setDelivery(e.target.value);pending.current=null;}} style={{display:'block',padding:9,width:120}}/></label>
     <label>Frais retour (TND)<input required type="number" min="0" max="10000" step="0.001" value={returns} onChange={e=>{setReturns(e.target.value);pending.current=null;}} style={{display:'block',padding:9,width:120}}/></label>
    </div>
    <fieldset style={{border:'1px solid #d6e2e8',padding:12,borderRadius:8}}>
     <legend>Gouvernorats couverts ({areas.length})</legend>
     <div style={{display:'flex',flexWrap:'wrap',gap:12}}>{governors.map(region=><label key={region}>
      <input type="checkbox" checked={areas.includes(region)} onChange={event=>{
       setAreas(old=>event.target.checked?[...old,region]:old.filter(value=>value!==region));pending.current=null;
      }}/> {region}
     </label>)}</div>
    </fieldset>
    <button type="submit" disabled={busy||!areas.length} style={{width:'fit-content',padding:12}}>Ajouter le transporteur</button>
   </form>
   <h3>Partenaires configurés</h3>
   {carriers.map(c=><div key={c.id} style={{borderTop:'1px solid #e5ebf0',padding:12,display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
    <div><strong>{c.name}</strong> · {c.active?'Actif':'Inactif'}<p>{c.governorates.join(', ')} · Aller {tnd(c.deliveryCost)} TND · Retour {tnd(c.returnCost)} TND</p></div>
    <button type="button" disabled={busy} onClick={()=>void mutate({...c,active:!c.active})}>{c.active?'Désactiver':'Activer'}</button>
   </div>)}
   {carriers.length===0&&<p>Aucun transporteur configuré.</p>}
  </>}
 </section>;
}
