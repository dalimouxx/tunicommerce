'use client';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {PAGE_HISTORY_LIMIT,pageRevision,pageRevisionSummary,pageHistoryLabels,type PageRevision,type PageRevisionSummary} from '../modules/shops/page-history';
import {ShopPageSections} from './shop-page-content';
import styles from './shop-pages.module.css';
import historyStyles from './shop-home.module.css';

export default function ShopPageHistory({endpoint,disabled,onRestore}:{endpoint:string;disabled:boolean;onRestore:(id:string)=>void}){
 const [open,setOpen]=useState(false),[entries,setEntries]=useState<PageRevisionSummary[]>([]),[selected,setSelected]=useState<PageRevision|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirming,setConfirming]=useState(false);
 const active=useRef<AbortController|null>(null),confirmButton=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>()=>{active.current?.abort();active.current=null;},[]);
 useEffect(()=>{if(confirming)confirmButton.current?.focus();},[confirming]);
 async function load(id?:string){
  active.current?.abort();const controller=new AbortController();active.current=controller;const timeout=setTimeout(()=>controller.abort(),45000);
  setOpen(true);setBusy(true);setError('');setSelected(null);setConfirming(false);
  try{
   const response=await fetch(endpoint+'/history'+(id?'/'+encodeURIComponent(id):''),{cache:'no-store',signal:controller.signal});const data:unknown=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(response.status===401?'Ta session a expiré. Reconnecte-toi pour consulter l’historique.':response.status===404?'Cette page ou cette version n’est plus disponible. Recharge les pages.':'L’historique ne répond pas. Réessaie.');
   if(active.current!==controller)return;
   if(id)setSelected(pageRevision.parse(data));else setEntries(z.object({revisions:z.array(pageRevisionSummary).max(PAGE_HISTORY_LIMIT)}).parse(data).revisions);
  }catch(error){if(active.current===controller)setError(controller.signal.aborted?'Le chargement prend trop de temps. Réessaie.':error instanceof z.ZodError?'La réponse de l’historique est incomplète. Réessaie.':error instanceof Error?error.message:'Historique indisponible.');}
  finally{clearTimeout(timeout);if(active.current===controller){active.current=null;setBusy(false);}}
 }
 function close(){active.current?.abort();active.current=null;setBusy(false);setOpen(false);setSelected(null);setConfirming(false);setError('');}
 return <section className={historyStyles.history} aria-label="Historique de la page">
  <div className={styles.head}><div><h2>L’histoire de cette page</h2><p className={styles.muted}>Les {PAGE_HISTORY_LIMIT} dernières étapes. Restaurer prépare un brouillon, sans publier ni changer l’adresse.</p></div><button className={styles.secondary} disabled={disabled||busy} aria-expanded={open} onClick={()=>open?close():void load()}>{open?'Fermer l’historique':'Consulter l’historique de la page'}</button></div>
  {disabled&&<p className={styles.muted}>Enregistre tes modifications ou termine l’opération en cours avant de restaurer une version.</p>}
  {open&&<div className={historyStyles.historyBody}>
   {busy&&<p role="status">Chargement de l’historique…</p>}{error&&<p className={styles.error} role="alert">{error}</p>}
   <button className={styles.secondary} disabled={busy||disabled} onClick={()=>void load()}>Actualiser la liste</button>
   {!busy&&!error&&!entries.length&&<p>Aucune étape conservée. Le prochain enregistrement commencera l’historique de cette page.</p>}
   <div className={historyStyles.historyGrid}>
    <ol className={historyStyles.historyList}>{entries.map(entry=><li key={entry.id}><button className={historyStyles.historyEntry} disabled={busy||disabled} aria-pressed={selected?.id===entry.id} onClick={()=>void load(entry.id)}><span className={historyStyles.historyBadge}>{entry.version===null?'Avant historique':'V'+entry.version} · {pageHistoryLabels[entry.action]}</span><strong dir="auto">{entry.title}</strong><span>{new Date(entry.createdAt).toLocaleString('fr-TN')} · {entry.language.toUpperCase()} · {entry.sections} section(s)</span></button></li>)}</ol>
    {selected&&<div className={historyStyles.historyPreview} aria-label="Aperçu de la version de page"><h3>{pageHistoryLabels[selected.action]} · {selected.version===null?'version antérieure':'version '+selected.version}</h3><div lang={selected.content.language} dir={selected.content.language==='ar'?'rtl':'ltr'}><h3 dir="auto">{selected.content.title}</h3><p dir="auto">{selected.content.description}</p><ShopPageSections content={selected.content} interactive={false}/></div><button className={styles.primary} disabled={disabled||busy} onClick={()=>setConfirming(true)}>Restaurer cette version dans le brouillon</button>
     {confirming&&<div className={historyStyles.note} role="alertdialog" aria-label="Confirmer la restauration de la page"><h4>Reprendre cette version ?</h4><p>Le brouillon actuel restera dans les étapes conservées. La page publique gardera son contenu et son adresse.</p><div className={styles.actions}><button ref={confirmButton} className={styles.primary} disabled={disabled||busy} onClick={()=>{setConfirming(false);onRestore(selected.id);}}>Confirmer la restauration</button><button className={styles.secondary} onClick={()=>setConfirming(false)}>Annuler</button></div></div>}
     <p className={styles.muted}>Vérifie le brouillon restauré, puis publie-le si tu souhaites le rendre visible.</p>
    </div>}
   </div>
  </div>}
 </section>;
}
