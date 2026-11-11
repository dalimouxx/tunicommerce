'use client';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {HOME_HISTORY_LIMIT,homeHistoryLabels,homeRevision,homeRevisionSummary,type HomeRevision,type HomeRevisionSummary} from '../modules/shops/home-history';
import ShopHomeSections from './shop-home-sections';
import styles from './shop-pages.module.css';
import homeStyles from './shop-home.module.css';

export default function ShopHomeHistory({endpoint,version,disabled,onRestore}:{endpoint:string;version:number;disabled:boolean;onRestore:(id:string)=>void}){
 const [open,setOpen]=useState(false),[entries,setEntries]=useState<HomeRevisionSummary[]>([]),[selected,setSelected]=useState<HomeRevision|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[language,setLanguage]=useState<'fr'|'ar'>('fr');
 const active=useRef<AbortController|null>(null),confirmButton=useRef<HTMLButtonElement|null>(null);
 const [confirming,setConfirming]=useState(false);
 useEffect(()=>{if(confirming)confirmButton.current?.focus();},[confirming]);
 useEffect(()=>()=>active.current?.abort(),[]);
 useEffect(()=>{active.current?.abort();setOpen(false);setSelected(null);setEntries([]);setBusy(false);setError('');setConfirming(false);},[version]);
 async function load(id?:string){
  active.current?.abort();const controller=new AbortController();active.current=controller;const timeout=setTimeout(()=>controller.abort(),45000);
  setOpen(true);setBusy(true);setError('');setSelected(null);setConfirming(false);
  try{
   const response=await fetch(endpoint+'/history'+(id?'/'+encodeURIComponent(id):''),{cache:'no-store',signal:controller.signal});const data:unknown=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(response.status===401?'Ta session a expiré. Reconnecte-toi pour consulter l’historique.':response.status===404?'Cette version n’est plus disponible. Actualise la liste.':'L’historique ne répond pas. Réessaie.');
   if(id)setSelected(homeRevision.parse(data));else setEntries(z.object({revisions:z.array(homeRevisionSummary).max(HOME_HISTORY_LIMIT)}).parse(data).revisions);
  }catch(error){if(active.current===controller)setError(controller.signal.aborted?'Le chargement prend trop de temps. Réessaie.':error instanceof z.ZodError?'La réponse de l’historique est incomplète. Réessaie.':error instanceof Error?error.message:'Historique indisponible.');}
  finally{clearTimeout(timeout);if(active.current===controller){active.current=null;setBusy(false);}}
 }
 function close(){active.current?.abort();active.current=null;setBusy(false);setOpen(false);setSelected(null);setError('');setConfirming(false);}
 return <section className={homeStyles.history} aria-label="Historique de l’accueil">
  <div className={styles.head}><div><h2>Remonte le fil de ton accueil</h2><p className={styles.muted}>Les {HOME_HISTORY_LIMIT} dernières étapes sont conservées. Une restauration prépare un brouillon ; elle ne publie rien.</p></div><button className={styles.secondary} disabled={disabled||busy} aria-expanded={open} onClick={()=>open?close():void load()}>{open?'Fermer l’historique':'Consulter l’historique'}</button></div>
  {disabled&&<p className={styles.muted}>Termine l’enregistrement ou le choix de version en cours avant de restaurer un accueil.</p>}
  {open&&<div className={homeStyles.historyBody}>
   {busy&&<p role="status">Chargement de l’historique…</p>}
   {error&&<p className={styles.error} role="alert">{error}</p>}
   <button className={styles.secondary} disabled={busy||disabled} onClick={()=>void load()}>Actualiser la liste</button>
   {!busy&&!error&&entries.length===0&&<p>Aucune étape conservée pour le moment. Le prochain enregistrement commencera ton historique.</p>}
   <div className={homeStyles.historyGrid}>
    <ol className={homeStyles.historyList}>{entries.map(entry=><li key={entry.id}><button className={homeStyles.historyEntry} disabled={busy||disabled} aria-pressed={selected?.id===entry.id} onClick={()=>void load(entry.id)}><span className={homeStyles.historyBadge}>V{entry.version} · {homeHistoryLabels[entry.action]}</span><strong dir="auto">{entry.title}</strong><span>{new Date(entry.createdAt).toLocaleString('fr-TN')} · {entry.sections} section(s) FR + AR</span></button></li>)}</ol>
    {selected&&<div className={homeStyles.historyPreview} aria-label="Aperçu de la version choisie"><h3>Version {selected.version} · {homeHistoryLabels[selected.action]}</h3><div className={styles.actions}><button className={styles.secondary} aria-pressed={language==='fr'} onClick={()=>setLanguage('fr')}>Français</button><button className={styles.secondary} aria-pressed={language==='ar'} onClick={()=>setLanguage('ar')}>العربية</button></div><div lang={language} dir={language==='ar'?'rtl':'ltr'}><p className={styles.muted}>Bandeau : {selected.content[language].announcement||'Texte du thème'}</p><h3 dir="auto">{selected.content[language].heroTitle||'Titre du thème'}</h3><p dir="auto">{selected.content[language].heroDescription||'Présentation du thème'}</p><ShopHomeSections content={selected.content} lang={language} preview/><p className={styles.muted}>Sections {selected.content.sectionsPosition==='beforeCatalog'?'avant':'après'} le catalogue · Réassurance du thème {selected.content.showBenefits?'affichée':'masquée'}</p></div><button className={styles.primary} disabled={disabled||busy} onClick={()=>setConfirming(true)}>Restaurer cette version dans le brouillon</button>{confirming&&<div className={homeStyles.note} role="alertdialog" aria-label="Confirmer la restauration"><h4>Reprendre la version {selected.version} ?</h4><p>Le brouillon actuel restera dans les dernières étapes conservées. La vitrine publique ne changera pas.</p><div className={styles.actions}><button ref={confirmButton} className={styles.primary} disabled={disabled||busy} onClick={()=>{setConfirming(false);onRestore(selected.id);}}>Confirmer la restauration</button><button className={styles.secondary} onClick={()=>setConfirming(false)}>Annuler</button></div></div>}<p className={styles.muted}>Le catalogue, les commandes et l’accueil publié restent inchangés. Vérifie le brouillon puis publie-le si tu le souhaites.</p></div>}
   </div>
  </div>}
 </section>;
}
