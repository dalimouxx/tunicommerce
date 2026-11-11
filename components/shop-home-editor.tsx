'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {homeContent,type HomeContent,type HomeEditorRecord} from '../modules/shops/home-content';
import {pageSectionLabels,type PageSection} from '../modules/shops/page-content';
import {HomeConflictError,HomeRequestError,homeEditorRequest,saveHomeDraft,mergeHomeDraft,sameHome,homeRecoveryKey,parseHomeRecovery,serializeHomeRecovery,homeFieldLabel,homeValidationMessage,type HomeRecovery} from '../modules/shops/home-editor-state';
import styles from './shop-pages.module.css';
import homeStyles from './shop-home.module.css';
import ShopHomeSections from './shop-home-sections';

export default function ShopHomeEditor({shopId,userId,publicPath,legacy=false,initial}:{shopId:string;userId:string;publicPath:string|null;legacy?:boolean;initial:HomeEditorRecord}){
 const [record,setRecord]=useState(initial),[content,setContent]=useState(initial.draft),[lang,setLang]=useState<'fr'|'ar'>('fr');
 const [type,setType]=useState<PageSection['type']>('text'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const inFlight=useRef(false),dirty=JSON.stringify(content)!==JSON.stringify(record.draft),current=content[lang];
 const [conflict,setConflict]=useState<HomeConflictError|null>(null),[recovery,setRecovery]=useState<HomeRecovery|null>(null),[storageReady,setStorageReady]=useState(false),[backupSaved,setBackupSaved]=useState(false),[storageWarning,setStorageWarning]=useState(''),[focusPath,setFocusPath]=useState('');
 const storageKey=homeRecoveryKey(userId,shopId),backup=useRef<HomeRecovery|null>(null),activeRequest=useRef<AbortController|null>(null),notice=useRef<HTMLDivElement|null>(null);
 backup.current=dirty?{format:1,savedAt:Date.now(),version:record.version,base:record.draft,content}:null;
 const endpoint='/api/v1/shops/'+encodeURIComponent(shopId)+'/home';
 useEffect(()=>{try{const saved=parseHomeRecovery(sessionStorage.getItem(storageKey));if(saved&&!sameHome(saved.content,initial.draft))setRecovery(saved);else sessionStorage.removeItem(storageKey);}catch{setStorageWarning('La copie de sécurité dans cet onglet est indisponible. Garde cet écran ouvert tant que le serveur n’a pas confirmé l’enregistrement.');}setStorageReady(true);},[storageKey]);
 useEffect(()=>{if(!storageReady||recovery)return;const timer=setTimeout(()=>{try{if(backup.current){sessionStorage.setItem(storageKey,serializeHomeRecovery(backup.current));setBackupSaved(true);}else{sessionStorage.removeItem(storageKey);setBackupSaved(false);}}catch{setBackupSaved(false);setStorageWarning('Copie locale indisponible. Tes modifications restent dans cet écran ; attends la confirmation du serveur avant de fermer.');}},300);return()=>clearTimeout(timer);},[content,record,storageKey,storageReady,recovery]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{try{if(backup.current&&!recovery)sessionStorage.setItem(storageKey,serializeHomeRecovery(backup.current));}catch{}event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,storageKey,recovery]);
 useEffect(()=>()=>{activeRequest.current?.abort();try{if(backup.current)sessionStorage.setItem(storageKey,serializeHomeRecovery(backup.current));}catch{}},[storageKey]);
 useEffect(()=>{if(!error)return;const frame=requestAnimationFrame(()=>{const input=focusPath?document.querySelector<HTMLElement>('[data-home-field="'+focusPath+'"]'):null;if(input){input.focus({preventScroll:true});input.scrollIntoView({block:'center'});}else notice.current?.scrollIntoView({block:'nearest'});});return()=>cancelAnimationFrame(frame);},[error,focusPath,lang]);
 function field(path:string){return {'data-home-field':path,'aria-invalid':focusPath===path||undefined};}
 function clearBackup(){try{sessionStorage.removeItem(storageKey);}catch{}setRecovery(null);setBackupSaved(false);}
 function accept(next:HomeEditorRecord){setRecord(next);setContent(next.draft);setConflict(null);setFocusPath('');clearBackup();}
 function recoverDraft(){if(!recovery)return;const merged=mergeHomeDraft(recovery.base,recovery.content,record.draft);setContent(merged.content);if(merged.conflicts.length){setRecord({...record,draft:recovery.base,version:recovery.version});setConflict(new HomeConflictError(record,merged.conflicts));}setRecovery(null);setMessage('Modifications récupérées dans cet écran. Enregistre-les pour les envoyer au serveur.');}
 function editing(){setMessage('');setError('');setFocusPath('');}
 function localized(next:Partial<HomeContent['fr']>){editing();setContent({...content,[lang]:{...current,...next}});}
 function updateSection(next:PageSection){localized({sections:current.sections.map(section=>section.id===next.id?next:section)});}
 function move(index:number,direction:number){const sections=[...current.sections],target=index+direction;if(target<0||target>=sections.length)return;[sections[index],sections[target]]=[sections[target],sections[index]];localized({sections});}
 function addSection(){
  if(current.sections.length>=8)return;const id=crypto.randomUUID(),title=pageSectionLabels[type];
  const section:PageSection=type==='faq'?{id,type,title,items:[{question:'Votre question',answer:'Votre réponse'}]}:
   type==='benefits'?{id,type,title,items:['Votre point fort']}:
   type==='cta'?{id,type,title,text:'Découvrez notre collection.',label:'Voir les produits'}:{id,type,title,text:'Votre texte'};
  localized({sections:[...current.sections,section]});
 }
 async function request(action:'save'|'publish'|'unpublish'|'restore'|'reload'|'overwrite'){
  if(inFlight.current)return;
  setMessage('');
  if(action==='save'||action==='overwrite'){const valid=homeContent.safeParse(content);if(!valid.success){const issue=valid.error.issues[0];setError(homeValidationMessage(issue));setFocusPath(issue.path.join('.'));if(issue.path[0]==='ar'||issue.path[0]==='fr')setLang(issue.path[0]);return;}}
  if(action==='reload'&&(dirty||recovery)&&!window.confirm('Charger la version du serveur et abandonner les modifications non enregistrées, y compris la copie locale ?'))return;
  if(action==='restore'&&!window.confirm('Remplacer le brouillon par la version actuellement publiée ?'))return;
  if(action==='unpublish'&&!window.confirm('Revenir à l’accueil du thème ? Le brouillon sera conservé, ainsi que les produits et commandes.'))return;
  if(action==='overwrite'&&(!conflict||!window.confirm('Remplacer le brouillon enregistré sur le serveur par les textes et sections affichés ici ?')))return;
  inFlight.current=true;setBusy(true);setError('');setMessage('');setFocusPath('');
  const controller=new AbortController();activeRequest.current=controller;const timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const data=action==='save'||action==='overwrite'?await saveHomeDraft(endpoint,action==='overwrite'?conflict!.latest:record,content,controller.signal):await homeEditorRequest(endpoint,action==='reload'?undefined:{action,version:record.version},controller.signal);
   accept(data);
   setMessage(action==='save'||action==='overwrite'?'Brouillon enregistré. Publiez-le pour le rendre visible.':action==='publish'?'Accueil publié dans les deux langues.':action==='unpublish'?'Accueil du thème rétabli. Le brouillon est conservé.':action==='restore'?'Version publiée recopiée dans le brouillon.':'Dernière version chargée.');
  }catch(error){
   if(error instanceof HomeConflictError){setConflict(error);setError(error.message);}
   else if(error instanceof HomeRequestError&&error.status===409){try{setConflict(new HomeConflictError(await homeEditorRequest(endpoint,undefined,controller.signal),[]));setError('Le brouillon enregistré a changé. Vérifie la version du serveur avant de publier ou remplacer du contenu.');}catch{setError('La version a changé et le serveur ne répond pas. Tes modifications sont conservées ; réessaie.');}}
   else setError(controller.signal.aborted?'La connexion prend trop de temps. Tes modifications sont conservées. Réessaie l’enregistrement.':error instanceof HomeRequestError?error.message:'Connexion interrompue ou réponse invalide. Tes modifications sont conservées ; réessaie.');
  }finally{clearTimeout(timeout);activeRequest.current=null;inFlight.current=false;setBusy(false);}
 }
 return <div className={homeStyles.editor}>
  <div className={styles.head}><div><h1>Compose l’accueil de ta boutique</h1><p className={styles.muted}>Personnalise tes textes et tes sections en gardant ton thème, ton catalogue et ton panier.</p></div><button className={styles.secondary} disabled={busy} onClick={()=>void request('reload')}>Recharger</button></div>
  <p className={homeStyles.note}>{record.publishedAt?(record.hasUnpublishedChanges?'Un accueil est publié ; le brouillon enregistré contient des changements.':'Le brouillon enregistré correspond à l’accueil publié.'):'L’accueil du thème est utilisé tant qu’aucun accueil personnalisé n’est publié.'} {dirty?'Des modifications ne sont pas enregistrées.':''}</p>
  <div ref={notice}>{error&&<p className={styles.error} role="alert">{error}{error.includes('session')&&<> <a href="/connexion/boutique" target="_blank" rel="noopener noreferrer">Ouvrir la connexion dans un autre onglet</a></>}</p>}{message&&<p className={styles.success} role="status">{message}</p>}</div>
  {storageWarning&&<p className={styles.muted}>{storageWarning}</p>}
  {recovery&&<section className={homeStyles.note} aria-label="Récupération du brouillon"><strong>Des modifications non enregistrées ont été retrouvées dans cet onglet.</strong><p>Elles datent du {new Date(recovery.savedAt).toLocaleString('fr-TN')}. La version publique n’a pas changé.</p><div className={styles.actions}><button className={styles.primary} disabled={busy||dirty} onClick={recoverDraft}>Récupérer mes modifications</button><button className={styles.secondary} disabled={busy} onClick={()=>{if(window.confirm('Supprimer uniquement cette copie locale non enregistrée ?'))clearBackup();}}>Ignorer cette copie locale</button></div></section>}
  {conflict&&<section className={homeStyles.note} aria-label="Conflit de sauvegarde"><h2>Deux versions du brouillon</h2><p>Tes modifications restent affichées. Les changements du serveur ne sont pas écrasés automatiquement.{conflict.conflicts.length>0?' Champs concernés : '+conflict.conflicts.map(path=>homeFieldLabel(path.split('.'))).join(', ')+'.':''}</p><details><summary>Consulter les textes enregistrés sur le serveur</summary>{(['fr','ar'] as const).map(language=><div key={language} lang={language} dir={language==='ar'?'rtl':'ltr'}><strong>{language.toUpperCase()} · {conflict.latest.draft[language].heroTitle||'Titre du thème'}</strong><p>{conflict.latest.draft[language].heroDescription}</p><p>{conflict.latest.draft[language].announcement}</p><ShopHomeSections content={conflict.latest.draft} lang={language} preview/></div>)}</details><div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={()=>void request('reload')}>Charger la version du serveur</button><button className={styles.primary} disabled={busy} onClick={()=>void request('overwrite')}>Enregistrer ma version à la place</button></div></section>}
  <section className={styles.panel}><div className={homeStyles.toolbar} role="group" aria-label="Langue à modifier"><button className={styles.secondary} disabled={busy} aria-pressed={lang==='fr'} onClick={()=>setLang('fr')}>Français</button><button className={styles.secondary} disabled={busy} aria-pressed={lang==='ar'} onClick={()=>setLang('ar')}>العربية</button></div>
   <p className={styles.muted}>Chaque langue possède ses textes et sections. Un champ vide conserve le texte du thème. Aucune traduction automatique n’est effectuée.</p>
   <fieldset disabled={busy||!!recovery} onChangeCapture={editing}><div className={styles.form}>
    <label>Titre principal · {lang.toUpperCase()}<input {...field(lang+'.heroTitle')} dir="auto" value={current.heroTitle} maxLength={140} placeholder="Laisser vide pour le nom de la boutique" onChange={e=>localized({heroTitle:e.target.value})}/></label>
    <label>Présentation · {lang.toUpperCase()}<textarea {...field(lang+'.heroDescription')} dir="auto" value={current.heroDescription} maxLength={1000} onChange={e=>localized({heroDescription:e.target.value})}/></label>
    <label>Bandeau supérieur · {lang.toUpperCase()}<input {...field(lang+'.announcement')} dir="auto" value={current.announcement} maxLength={180} onChange={e=>localized({announcement:e.target.value})}/></label>
    <h2>Sections · {lang.toUpperCase()} · {current.sections.length}/8</h2>
    {current.sections.map((section,index)=><div className={styles.sectionEditor} key={section.id}>
     <div className={styles.sectionHeading}><strong>{index+1}. {pageSectionLabels[section.type]}</strong><div className={styles.actions}>
      <button type="button" aria-label={'Monter la section '+(index+1)} disabled={index===0} onClick={()=>move(index,-1)}>↑</button>
      <button type="button" aria-label={'Descendre la section '+(index+1)} disabled={index===current.sections.length-1} onClick={()=>move(index,1)}>↓</button>
      <button type="button" onClick={()=>localized({sections:current.sections.filter(item=>item.id!==section.id)})}>Retirer</button>
     </div></div>
     <label>Titre<input {...field(lang+'.sections.'+index+'.title')} dir="auto" value={section.title} maxLength={140} onChange={e=>updateSection({...section,title:e.target.value})}/></label>
     {(section.type==='text'||section.type==='hero'||section.type==='cta')&&<label>Texte<textarea {...field(lang+'.sections.'+index+'.text')} dir="auto" value={section.text} maxLength={2500} onChange={e=>updateSection({...section,text:e.target.value})}/></label>}
     {section.type==='cta'&&<label>Bouton vers le catalogue<input {...field(lang+'.sections.'+index+'.label')} dir="auto" value={section.label} maxLength={60} onChange={e=>updateSection({...section,label:e.target.value})}/></label>}
     {section.type==='benefits'&&<>{section.items.map((item,i)=><div className={styles.repeated} key={i}><label>Point fort {i+1}<input {...field(lang+'.sections.'+index+'.items.'+i)} dir="auto" value={item} maxLength={140} onChange={e=>updateSection({...section,items:section.items.map((value,n)=>i===n?e.target.value:value)})}/></label><button type="button" className={styles.secondary} disabled={section.items.length===1} onClick={()=>updateSection({...section,items:section.items.filter((_,n)=>n!==i)})}>Retirer ce point</button></div>)}<button type="button" className={styles.secondary} disabled={section.items.length>=6} onClick={()=>updateSection({...section,items:[...section.items,'Nouveau point fort']})}>Ajouter un point fort</button></>}
     {section.type==='faq'&&<>{section.items.map((item,i)=><div className={styles.repeated} key={i}><label>Question {i+1}<input {...field(lang+'.sections.'+index+'.items.'+i+'.question')} dir="auto" maxLength={140} value={item.question} onChange={e=>updateSection({...section,items:section.items.map((value,n)=>i===n?{...value,question:e.target.value}:value)})}/></label><label>Réponse<textarea {...field(lang+'.sections.'+index+'.items.'+i+'.answer')} dir="auto" maxLength={2500} value={item.answer} onChange={e=>updateSection({...section,items:section.items.map((value,n)=>i===n?{...value,answer:e.target.value}:value)})}/></label><button type="button" className={styles.secondary} disabled={section.items.length===1} onClick={()=>updateSection({...section,items:section.items.filter((_,n)=>n!==i)})}>Retirer cette question</button></div>)}<button type="button" className={styles.secondary} disabled={section.items.length>=8} onClick={()=>updateSection({...section,items:[...section.items,{question:'Nouvelle question',answer:'Votre réponse'}]})}>Ajouter une question</button></>}
    </div>)}
    <div className={styles.actions}><select aria-label="Type de section" value={type} onChange={e=>setType(e.target.value as PageSection['type'])}>{Object.entries(pageSectionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button type="button" className={styles.secondary} disabled={current.sections.length>=8} onClick={addSection}>Ajouter une section</button></div>
    <h2>Disposition commune aux deux langues</h2>
    <label>Position des sections<select {...field('sectionsPosition')} value={content.sectionsPosition} onChange={e=>setContent({...content,sectionsPosition:e.target.value as HomeContent['sectionsPosition']})}><option value="beforeCatalog">Avant le catalogue</option><option value="afterCatalog">Après le catalogue</option></select></label>
    {!legacy&&<label><span><input type="checkbox" checked={content.showBenefits} onChange={e=>setContent({...content,showBenefits:e.target.checked})}/> Afficher les trois points de réassurance du thème</span></label>}
   </div></fieldset>
  </section>
  <div className={styles.actions+' '+homeStyles.saveBar}>
   <span className={homeStyles.saveState}>{busy?'Enregistrement ou chargement en cours…':conflict?'Choisis la version à conserver.':dirty?(backupSaved?'Modifications non enregistrées · copie protégée dans cet onglet':'Modifications non enregistrées'):record.version>0?'Brouillon enregistré sur le serveur':'Prêt à enregistrer ton premier brouillon'}</span>
   <button className={styles.primary} disabled={busy||!!conflict||!!recovery||!dirty&&record.version>0} onClick={()=>void request('save')}>Enregistrer le brouillon</button>
   <button className={styles.primary} disabled={busy||!!conflict||!!recovery||dirty||record.version===0||!!record.publishedAt&&!record.hasUnpublishedChanges} onClick={()=>void request('publish')}>Publier l’accueil enregistré</button>
  </div>
  <div className={styles.actions}>
   <Link className={styles.secondary} href={'/mes-boutiques/'+shopId+'/accueil/apercu?lang='+lang} target="_blank" rel="noopener noreferrer">Aperçu du brouillon enregistré ↗</Link>
   {record.publishedAt&&<><button className={styles.secondary} disabled={busy||dirty||!!conflict||!!recovery} onClick={()=>void request('restore')}>Restaurer le brouillon depuis la version publiée</button><button className={styles.secondary} disabled={busy||dirty||!!conflict||!!recovery} onClick={()=>void request('unpublish')}>Revenir à l’accueil du thème</button></>}
   {publicPath&&<Link href={publicPath+'?lang='+lang} target="_blank" rel="noopener noreferrer">Voir la boutique publique ↗</Link>}
  </div><p className={styles.muted}>La publication exige une boutique publiée et un abonnement valide. Les images de l’en-tête se règlent dans Apparence. Le catalogue, le panier et les conditions de commande restent gérés par la boutique.</p>
 </div>;
}


