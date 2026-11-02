'use client';
import {useState,type FormEvent} from 'react';
import {Save,ShieldCheck} from 'lucide-react';
import styles from '../app/admin/platform.module.css';

type Quota={maxProducts:number|null;maxOrdersPerMonth:number|null;maxPhotos:number|null};
const readable=(limit:number|null)=>limit===null||limit===0?'Illimité':String(limit);
const inputLimit=(data:FormData,key:string)=>{
 const value=String(data.get(key)||'').trim();
 return value===''?null:Number(value);
};
export default function PlanOverrideEditor({
 workspaceId,planCode,plan,override
}:{
 workspaceId:string;planCode:string;plan:Quota|null;
 override:Quota&{note:string}|null
}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [saved,setSaved]=useState('');
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');setSaved('');
  const data=new FormData(e.currentTarget);
  try{
   const response=await fetch('/api/admin/plan-overrides',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({
     workspaceId,maxProducts:inputLimit(data,'maxProducts'),
     maxOrdersPerMonth:inputLimit(data,'maxOrdersPerMonth'),
     maxPhotos:inputLimit(data,'maxPhotos'),
     note:String(data.get('note')||'')
    })
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Exception non enregistrée');
   setSaved('Exceptions enregistrées. Les nouveaux quotas sont actifs pour cette boutique.');
  }catch(e){setError(e instanceof Error?e.message:'Erreur');}
  finally{setBusy(false);}
 }
 return <section className={styles.panel}>
  <div className={styles.panelHead}>
   <div><h2><ShieldCheck size={18}/> Exceptions de cette boutique</h2>
    <p>Offre {planCode}. Une case vide hérite de la formule ; 0 donne une limite illimitée (sauf photos, maximum 30).</p>
   </div>
  </div>
  <form onSubmit={e=>void save(e)} className={styles.configForm}>
   <div className={styles.configGrid}>
    <label>Produits (offre : {readable(plan?.maxProducts??null)})
     <input name="maxProducts" type="number" min="0" defaultValue={override?.maxProducts??''} placeholder="Hériter"/>
    </label>
    <label>Commandes mensuelles (offre : {readable(plan?.maxOrdersPerMonth??null)})
     <input name="maxOrdersPerMonth" type="number" min="0" defaultValue={override?.maxOrdersPerMonth??''} placeholder="Hériter"/>
    </label>
    <label>Photos (offre : {readable(plan?.maxPhotos??null)})
     <input name="maxPhotos" type="number" min="0" defaultValue={override?.maxPhotos??''} placeholder="Hériter"/>
    </label>
    <label>Raison ou note administrative
     <input name="note" type="text" maxLength={500} defaultValue={override?.note||''}
      placeholder="Ex. client pilote, exception temporaire"/>
    </label>
   </div>
   {error&&<div className={styles.inlineError} role="alert">{error}</div>}
   {saved&&<div className={styles.inlineSuccess} role="status">{saved}</div>}
   <button type="submit" disabled={busy} className={styles.primary}>
    <Save size={16}/>{busy?'Enregistrement…':'Enregistrer les exceptions'}
   </button>
  </form>
 </section>;
}
