'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {CircleDollarSign,Package,ShoppingCart,Images,Users,Store,Save,Plus} from 'lucide-react';
import type {PlanInput,PlanModules} from '../../../modules/subscriptions/validation';
import styles from '../platform.module.css';

export type EditorPlan=PlanInput;
const moduleOptions:{key:keyof PlanModules;label:string}[]=[
 {key:'callCenter',label:'Call Center'},
 {key:'marketing',label:'Marketing avancé'},
 {key:'analytics',label:'Rapports avancés'},
 {key:'aiCopilot',label:'Commerce Copilot IA'},
 {key:'customDomain',label:'Domaine personnalisé'},
 {key:'multiShop',label:'Multi-boutique'}
];
const emptyModules:PlanModules={
 callCenter:false,marketing:false,analytics:false,aiCopilot:false,
 customDomain:false,multiShop:false
};
const formLimit=(fd:FormData,key:string)=>{
 const raw=String(fd.get(key)||'').trim();
 return raw===''?null:Number(raw);
};

function PlanForm({plan,onSaved}:{plan:EditorPlan;onSaved:(code:string)=>void}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const router=useRouter();

 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(busy)return;
  setBusy(true);setError('');setSuccess('');
  const fd=new FormData(e.currentTarget);
  const data:PlanInput={
   code:plan.code,name:String(fd.get('name')||''),
   description:String(fd.get('description')||''),
   priceMillimes:Math.round(Number(fd.get('priceTnd'))*1000),
   durationDays:Number(fd.get('durationDays')),
   maxProducts:formLimit(fd,'maxProducts'),
   maxOrdersPerMonth:formLimit(fd,'maxOrdersPerMonth'),
   maxPhotos:formLimit(fd,'maxPhotos'),
   maxShops:formLimit(fd,'maxShops'),
   maxMembers:formLimit(fd,'maxMembers'),
   enabled:fd.get('enabled')==='on',
   modules:Object.fromEntries(moduleOptions.map(m=>[m.key,fd.get('module_'+m.key)==='on'])) as PlanModules
  };
  try{
   const response=await fetch('/api/admin/plans',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Sauvegarde impossible');
   setSuccess('Offre enregistrée. Les limites sont appliquées aux prochaines créations uniquement.');
   router.refresh();onSaved(data.code);
  }catch(e){setError(e instanceof Error?e.message:'Échec de la sauvegarde');}
  finally{setBusy(false);}
 }

 return <form key={plan.code} onSubmit={e=>void save(e)} className={styles.planForm}>
  <div className={styles.planSection}>
   <h3>Identité et tarification</h3>
   <div className={styles.planInputs}>
    <label>Code d’identification<input value={plan.code} readOnly aria-label="Code plan"/></label>
    <label>Nom public<input name="name" required minLength={2} maxLength={80} defaultValue={plan.name}/></label>
    <label>Prix affiché (TND)<input name="priceTnd" type="number" min="0" max="100000" step=".001" required defaultValue={(plan.priceMillimes/1000).toFixed(3)}/></label>
    <label>Durée de référence (jours)<input name="durationDays" type="number" min="1" max="3650" required defaultValue={plan.durationDays}/></label>
    <label className={styles.planWide}>Description<textarea name="description" maxLength={500} rows={2} defaultValue={plan.description}/></label>
   </div>
   <label className={styles.planToggle}><input name="enabled" type="checkbox" defaultChecked={plan.enabled}/> Offre activée dans le catalogue</label>
  </div>
  <div className={styles.planSection}>
   <h3>Quotas opérationnels</h3>
   <p>Vide ou 0 = illimité. Une limite inférieure à l'utilisation actuelle ne supprime aucune donnée : elle bloque seulement les nouvelles créations.</p>
   <div className={styles.planInputs}>
    <label><Package size={15}/> Produits maximum<input name="maxProducts" type="number" min="0" defaultValue={plan.maxProducts??''} placeholder="Illimité"/></label>
    <label><ShoppingCart size={15}/> Commandes par mois<input name="maxOrdersPerMonth" type="number" min="0" defaultValue={plan.maxOrdersPerMonth??''} placeholder="Illimité"/></label>
    <label><Images size={15}/> Photos produits maximum<input name="maxPhotos" type="number" min="0" defaultValue={plan.maxPhotos??''} placeholder="Max. physique : 30"/></label>
    <label><Store size={15}/> Boutiques (préparation)<input name="maxShops" type="number" min="0" defaultValue={plan.maxShops??''} placeholder="Non appliqué"/></label>
    <label><Users size={15}/> Employés (préparation)<input name="maxMembers" type="number" min="0" defaultValue={plan.maxMembers??''} placeholder="Non appliqué"/></label>
   </div>
   <p>Le plafond physique actuel de la médiathèque est de 30 photos par boutique, même si cette offre indique plus.</p>
  </div>
  <div className={styles.planSection}>
   <h3>Modules et options</h3>
   <p>Ces indicateurs préparent la gestion des fonctionnalités premium. Ils ne débloquent ni ne bloquent encore automatiquement les modules concernés.</p>
   <div className={styles.planModules}>
    {moduleOptions.map(item=><label key={item.key}>
     <input name={'module_'+item.key} type="checkbox" defaultChecked={plan.modules[item.key]}/>
     {item.label}
    </label>)}
   </div>
  </div>
  {error&&<div role="alert" className={styles.inlineError}>{error}</div>}
  {success&&<div role="status" className={styles.inlineSuccess}>{success}</div>}
  <button type="submit" disabled={busy} className={styles.primary}><Save size={16}/>{busy?'Enregistrement…':'Enregistrer les paramètres'}</button>
 </form>;
}

export default function PlanManager({
 plans,assigned
}:{plans:EditorPlan[];assigned:Record<string,number>}){
 const [selected,setSelected]=useState(plans[0]?.code||'');
 const [creating,setCreating]=useState(false);
 const [newCode,setNewCode]=useState('');
 const [localCreated,setLocalCreated]=useState<string[]>([]);
 const active=plans.find(p=>p.code===selected);
 const draft:EditorPlan={
  code:newCode.toUpperCase().trim(),name:'Nouvelle offre',description:'',
  priceMillimes:0,durationDays:30,maxProducts:null,maxOrdersPerMonth:null,
  maxPhotos:null,maxShops:null,maxMembers:null,modules:emptyModules,enabled:true
 };
 return <>
  <div className={styles.planWorkspace}>
   <aside className={styles.planSidebar}>
    <h2>Catalogue des offres</h2>
    {plans.map(plan=><button key={plan.code} type="button"
     onClick={()=>{setSelected(plan.code);setCreating(false);}}
     className={styles.planChoose+(selected===plan.code&&!creating?' '+styles.planSelected:'')}>
     <strong>{plan.name}</strong>
     <small>{plan.code} · {assigned[plan.code]||0} boutique(s)</small>
     <span>{plan.enabled?'Disponible':'Désactivée'}</span>
    </button>)}
    <button type="button" className={styles.secondary} onClick={()=>{setCreating(true);setSelected('');}}>
     <Plus size={15}/> Nouvelle offre
    </button>
   </aside>
   <section className={styles.panel}>
    {creating?<div className={styles.planEditor}>
      <div className={styles.panelHead}><div><h2>Créer une offre SaaS</h2><p>Choisissez un code permanent. Les prix sont indicatifs tant que le moteur de facturation n'est pas branché.</p></div></div>
      <label className={styles.planNewCode}>Code unique (majuscules et chiffres)
       <input value={newCode} maxLength={24} onChange={e=>setNewCode(e.target.value.toUpperCase())}
        placeholder="PREMIUM_PLUS"/>
      </label>
      {/^[A-Z][A-Z0-9_]{1,23}$/.test(draft.code)?
       <PlanForm plan={draft} onSaved={code=>{setLocalCreated([...localCreated,code]);window.location.assign('/admin/plans');}}/>:
       <p className={styles.mutedEmpty}>Saisissez un code valide de 2 à 24 caractères pour créer cette offre.</p>}
    </div>:active?<div className={styles.planEditor} key={active.code}>
      <div className={styles.panelHead}><div>
       <h2><CircleDollarSign size={18}/> Configurer {active.name}</h2>
       <p>{assigned[active.code]||0} boutique(s) utilisent cette offre. La modification peut changer leurs quotas immédiatement.</p>
      </div></div>
      <PlanForm plan={active} onSaved={()=>{}}/>
    </div>:<div className={styles.empty}><Package size={28}/><strong>Sélectionnez une offre</strong></div>}
   </section>
  </div>
  {localCreated.length>0&&<p className={styles.mutedEmpty}>Offres créées : {localCreated.join(', ')}.</p>}
 </>;
}
