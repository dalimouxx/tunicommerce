'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {homeContent,type HomeContent,type HomeEditorRecord} from '../modules/shops/home-content';
import {pageSectionLabels,type PageSection} from '../modules/shops/page-content';
import styles from './shop-pages.module.css';
import homeStyles from './shop-home.module.css';

export default function ShopHomeEditor({shopId,shopSlug,initial}:{shopId:string;shopSlug:string;initial:HomeEditorRecord}){
 const [record,setRecord]=useState(initial),[content,setContent]=useState(initial.draft),[lang,setLang]=useState<'fr'|'ar'>('fr');
 const [type,setType]=useState<PageSection['type']>('text'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const inFlight=useRef(false),dirty=JSON.stringify(content)!==JSON.stringify(record.draft),current=content[lang];
 const endpoint='/api/v1/shops/'+encodeURIComponent(shopId)+'/home';
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 function localized(next:Partial<HomeContent['fr']>){setContent({...content,[lang]:{...current,...next}});}
 function updateSection(next:PageSection){localized({sections:current.sections.map(section=>section.id===next.id?next:section)});}
 function move(index:number,direction:number){const sections=[...current.sections],target=index+direction;if(target<0||target>=sections.length)return;[sections[index],sections[target]]=[sections[target],sections[index]];localized({sections});}
 function addSection(){
  if(current.sections.length>=8)return;const id=crypto.randomUUID(),title=pageSectionLabels[type];
  const section:PageSection=type==='faq'?{id,type,title,items:[{question:'Votre question',answer:'Votre réponse'}]}:
   type==='benefits'?{id,type,title,items:['Votre point fort']}:
   type==='cta'?{id,type,title,text:'Découvrez notre collection.',label:'Voir les produits'}:{id,type,title,text:'Votre texte'};
  localized({sections:[...current.sections,section]});
 }
 async function request(action:'save'|'publish'|'unpublish'|'restore'|'reload'){
  if(inFlight.current)return;
  if(action==='save'){const valid=homeContent.safeParse(content);if(!valid.success){setError(valid.error.issues[0]?.message||'Contenu invalide');return;}}
  if(action==='reload'&&dirty&&!window.confirm('Recharger et abandonner les modifications non enregistrées ?'))return;
  if(action==='restore'&&!window.confirm('Remplacer le brouillon par la version actuellement publiée ?'))return;
  if(action==='unpublish'&&!window.confirm('Revenir à l’accueil du thème ? Le brouillon sera conservé, ainsi que les produits et commandes.'))return;
  inFlight.current=true;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch(endpoint,action==='reload'?{cache:'no-store'}:{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({action,version:record.version,...(action==='save'?{content}:{})})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Modification indisponible');setRecord(data);setContent(data.draft);
   setMessage(action==='save'?'Brouillon enregistré. Publiez-le pour le rendre visible.':action==='publish'?'Accueil publié dans les deux langues.':action==='unpublish'?'Accueil du thème rétabli. Le brouillon est conservé.':action==='restore'?'Version publiée recopiée dans le brouillon.':'Dernière version chargée.');
  }catch(error){setError(error instanceof Error?error.message:'Connexion interrompue');}finally{inFlight.current=false;setBusy(false);}
 }
 return <div className={homeStyles.editor}>
  <div className={styles.head}><div><h1>Compose l’accueil de ta boutique</h1><p className={styles.muted}>Personnalise tes textes et tes sections en gardant ton thème, ton catalogue et ton panier.</p></div><button className={styles.secondary} disabled={busy} onClick={()=>void request('reload')}>Recharger</button></div>
  <p className={homeStyles.note}>{record.publishedAt?(record.hasUnpublishedChanges?'Un accueil est publié ; le brouillon enregistré contient des changements.':'Le brouillon enregistré correspond à l’accueil publié.'):'L’accueil du thème est utilisé tant qu’aucun accueil personnalisé n’est publié.'} {dirty?'Des modifications ne sont pas enregistrées.':''}</p>
  {error&&<p className={styles.error} role="alert">{error}</p>}{message&&<p className={styles.success} role="status">{message}</p>}
  <section className={styles.panel}><div className={homeStyles.toolbar} role="group" aria-label="Langue à modifier"><button className={styles.secondary} disabled={busy} aria-pressed={lang==='fr'} onClick={()=>setLang('fr')}>Français</button><button className={styles.secondary} disabled={busy} aria-pressed={lang==='ar'} onClick={()=>setLang('ar')}>العربية</button></div>
   <p className={styles.muted}>Chaque langue possède ses textes et sections. Un champ vide conserve le texte du thème. Aucune traduction automatique n’est effectuée.</p>
   <fieldset disabled={busy}><div className={styles.form}>
    <label>Titre principal · {lang.toUpperCase()}<input dir="auto" value={current.heroTitle} maxLength={140} placeholder="Laisser vide pour le nom de la boutique" onChange={e=>localized({heroTitle:e.target.value})}/></label>
    <label>Présentation · {lang.toUpperCase()}<textarea dir="auto" value={current.heroDescription} maxLength={1000} onChange={e=>localized({heroDescription:e.target.value})}/></label>
    <label>Bandeau supérieur · {lang.toUpperCase()}<input dir="auto" value={current.announcement} maxLength={180} onChange={e=>localized({announcement:e.target.value})}/></label>
    <h2>Sections · {lang.toUpperCase()} · {current.sections.length}/8</h2>
    {current.sections.map((section,index)=><div className={styles.sectionEditor} key={section.id}>
     <div className={styles.sectionHeading}><strong>{index+1}. {pageSectionLabels[section.type]}</strong><div className={styles.actions}>
      <button type="button" aria-label={'Monter la section '+(index+1)} disabled={index===0} onClick={()=>move(index,-1)}>↑</button>
      <button type="button" aria-label={'Descendre la section '+(index+1)} disabled={index===current.sections.length-1} onClick={()=>move(index,1)}>↓</button>
      <button type="button" onClick={()=>localized({sections:current.sections.filter(item=>item.id!==section.id)})}>Retirer</button>
     </div></div>
     <label>Titre<input dir="auto" value={section.title} maxLength={140} onChange={e=>updateSection({...section,title:e.target.value})}/></label>
     {(section.type==='text'||section.type==='hero'||section.type==='cta')&&<label>Texte<textarea dir="auto" value={section.text} maxLength={2500} onChange={e=>updateSection({...section,text:e.target.value})}/></label>}
     {section.type==='cta'&&<label>Bouton vers le catalogue<input dir="auto" value={section.label} maxLength={60} onChange={e=>updateSection({...section,label:e.target.value})}/></label>}
     {section.type==='benefits'&&<>{section.items.map((item,i)=><div className={styles.repeated} key={i}><label>Point fort {i+1}<input dir="auto" value={item} maxLength={140} onChange={e=>updateSection({...section,items:section.items.map((value,n)=>i===n?e.target.value:value)})}/></label><button type="button" className={styles.secondary} disabled={section.items.length===1} onClick={()=>updateSection({...section,items:section.items.filter((_,n)=>n!==i)})}>Retirer ce point</button></div>)}<button type="button" className={styles.secondary} disabled={section.items.length>=6} onClick={()=>updateSection({...section,items:[...section.items,'Nouveau point fort']})}>Ajouter un point fort</button></>}
     {section.type==='faq'&&<>{section.items.map((item,i)=><div className={styles.repeated} key={i}><label>Question {i+1}<input dir="auto" maxLength={140} value={item.question} onChange={e=>updateSection({...section,items:section.items.map((value,n)=>i===n?{...value,question:e.target.value}:value)})}/></label><label>Réponse<textarea dir="auto" maxLength={2500} value={item.answer} onChange={e=>updateSection({...section,items:section.items.map((value,n)=>i===n?{...value,answer:e.target.value}:value)})}/></label><button type="button" className={styles.secondary} disabled={section.items.length===1} onClick={()=>updateSection({...section,items:section.items.filter((_,n)=>n!==i)})}>Retirer cette question</button></div>)}<button type="button" className={styles.secondary} disabled={section.items.length>=8} onClick={()=>updateSection({...section,items:[...section.items,{question:'Nouvelle question',answer:'Votre réponse'}]})}>Ajouter une question</button></>}
    </div>)}
    <div className={styles.actions}><select aria-label="Type de section" value={type} onChange={e=>setType(e.target.value as PageSection['type'])}>{Object.entries(pageSectionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button type="button" className={styles.secondary} disabled={current.sections.length>=8} onClick={addSection}>Ajouter une section</button></div>
    <h2>Disposition commune aux deux langues</h2>
    <label>Position des sections<select value={content.sectionsPosition} onChange={e=>setContent({...content,sectionsPosition:e.target.value as HomeContent['sectionsPosition']})}><option value="beforeCatalog">Avant le catalogue</option><option value="afterCatalog">Après le catalogue</option></select></label>
    <label><span><input type="checkbox" checked={content.showBenefits} onChange={e=>setContent({...content,showBenefits:e.target.checked})}/> Afficher les trois points de réassurance du thème</span></label>
   </div></fieldset>
  </section>
  <div className={styles.actions}>
   <button className={styles.primary} disabled={busy||!dirty&&record.version>0} onClick={()=>void request('save')}>Enregistrer le brouillon</button>
   <Link className={styles.secondary} href={'/mes-boutiques/'+shopId+'/apercu?lang='+lang} target="_blank" rel="noopener noreferrer">Aperçu du brouillon enregistré ↗</Link>
   <button className={styles.primary} disabled={busy||dirty||record.version===0||!!record.publishedAt&&!record.hasUnpublishedChanges} onClick={()=>void request('publish')}>Publier l’accueil enregistré</button>
   {record.publishedAt&&<><button className={styles.secondary} disabled={busy||dirty} onClick={()=>void request('restore')}>Restaurer le brouillon depuis la version publiée</button><button className={styles.secondary} disabled={busy||dirty} onClick={()=>void request('unpublish')}>Revenir à l’accueil du thème</button></>}
   <Link href={'/vitrines/'+encodeURIComponent(shopSlug)+'?lang='+lang} target="_blank" rel="noopener noreferrer">Voir la boutique publique ↗</Link>
  </div><p className={styles.muted}>La publication exige une boutique publiée et un abonnement valide. Les images de l’en-tête se règlent dans Apparence. Le catalogue, le panier et les conditions de commande restent gérés par la boutique.</p>
 </div>;
}
