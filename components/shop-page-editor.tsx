'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {initialPageContent,pageContent,pageSectionLabels,type PageContent,type PageSection,type PageEditorRecord} from '../modules/shops/page-content';
import styles from './shop-pages.module.css';
import ShopPageHistory from './shop-page-history';
import ProductMediaLibrary from './product-media-library';
import {isSectionImageUrl} from '../modules/shops/section-image';
import imageStyles from './shop-home.module.css';

export default function ShopPageEditor({shopId,shopSlug,initialPages}:{shopId:string;shopSlug:string;initialPages:PageEditorRecord[]}){
 const [pages,setPages]=useState(initialPages),[selected,setSelected]=useState(initialPages[0]?.id||'');
 const [content,setContent]=useState<PageContent|null>(initialPages[0]?.draft||null);
 const [newTitle,setNewTitle]=useState(''),[newSlug,setNewSlug]=useState('');
 const [type,setType]=useState<PageSection['type']>('text'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const row=pages.find(page=>page.id===selected);
 const dirty=!!row&&!!content&&JSON.stringify(content)!==JSON.stringify(row.draft);
 const endpoint='/api/v1/shops/'+encodeURIComponent(shopId)+'/pages';
 const activeRequest=useRef<AbortController|null>(null);
 const [mediaSectionId,setMediaSectionId]=useState<string|null>(null),[mediaBusy,setMediaBusy]=useState(false);
 const selectedRef=useRef(selected);selectedRef.current=selected;
 useEffect(()=>{setMediaSectionId(null);},[selected]);
 function chooseImage(pageId:string,sectionId:string,url:string){
  if(selectedRef.current!==pageId)return;
  setMessage('');setError('');setContent(current=>current?{...current,sections:current.sections.map(section=>section.id===sectionId&&section.type==='image'?{...section,imageUrl:url}:section)}:current);setMediaSectionId(null);
 }
 useEffect(()=>()=>activeRequest.current?.abort(),[]);
 async function request(path:string,method:string,body?:unknown){
  const controller=new AbortController();activeRequest.current=controller;const timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetch(endpoint+path,{method,cache:'no-store',signal:controller.signal,headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const data=await response.json().catch(()=>null);if(!response.ok)throw Error(response.status===401?'Ta session a expiré. Reconnecte-toi dans un autre onglet puis réessaie.':data?.error||'Enregistrement indisponible');if(!data)throw Error('Réponse incomplète. Tes modifications sont conservées dans cet écran.');return data;
  }catch(error){if(controller.signal.aborted)throw Error('La connexion prend trop de temps. Tes modifications sont conservées dans cet écran ; réessaie.');throw error;}
  finally{clearTimeout(timeout);if(activeRequest.current===controller)activeRequest.current=null;}
 }
 function choose(page:PageEditorRecord){
  if(mediaBusy)return;
  if(dirty&&!window.confirm('Abandonner les modifications non enregistrées ?'))return;
  setSelected(page.id);setContent(page.draft);setError('');setMessage('');
 }
 async function create(){
  if(busy||mediaBusy)return;
  if(dirty&&!window.confirm('Abandonner les modifications non enregistrées et créer une page ?'))return;
  setBusy(true);setError('');setMessage('');
  try{
   const data=await request('','POST',{slug:newSlug,content:initialPageContent(newTitle)});
   setPages(current=>[...current,data.page]);setSelected(data.page.id);setContent(data.page.draft);setNewTitle('');setNewSlug('');setMessage('Page créée en brouillon.');
  }catch(error){setError(error instanceof Error?error.message:'Création indisponible');}finally{setBusy(false);}
 }
 async function change(action:'save'|'publish'|'unpublish'|'restoreRevision',revisionId?:string){
  if(busy||mediaBusy||!row||!content)return;
  if(action==='restoreRevision'&&(dirty||!revisionId))return;
  if(action==='save'){
   const valid=pageContent.safeParse(content);if(!valid.success){setError(valid.error.issues[0]?.message||'Contenu invalide');return;}
  }
  setBusy(true);setError('');setMessage('');
  try{
   const data=await request('/'+row.id,'PUT',{action,version:row.version,...(action==='save'?{content}:{}),...(action==='restoreRevision'?{revisionId}:{})});
   setPages(current=>current.map(page=>page.id===row.id?data.page:page));setContent(data.page.draft);
   setMessage(action==='save'?'Brouillon enregistré. La version publique reste inchangée.':action==='publish'?'La version enregistrée est maintenant publiée.':action==='restoreRevision'?'Ancienne version restaurée dans le brouillon. La page publique reste inchangée.':'Page retirée de la boutique publique.');
  }catch(error){setError(error instanceof Error?error.message:'Enregistrement indisponible');}finally{setBusy(false);}
 }
 async function remove(){
  if(busy||mediaBusy||!row||!window.confirm('Supprimer définitivement cette page, son brouillon, sa version publique et tout son historique ?'))return;
  setBusy(true);setError('');setMessage('');
  try{
   await request('/'+row.id,'DELETE',{version:row.version});const remaining=pages.filter(page=>page.id!==row.id);
   setPages(remaining);setSelected(remaining[0]?.id||'');setContent(remaining[0]?.draft||null);setMessage('Page supprimée.');
  }catch(error){setError(error instanceof Error?error.message:'Suppression indisponible');}finally{setBusy(false);}
 }
 async function reload(){
  if(busy||mediaBusy||(dirty&&!window.confirm('Recharger et abandonner les modifications non enregistrées ?')))return;
  setBusy(true);setError('');setMessage('');
  try{
   const data=await request('','GET'),next=data.pages.find((page:PageEditorRecord)=>page.id===selected)||data.pages[0];
   setPages(data.pages);setSelected(next?.id||'');setContent(next?.draft||null);setMessage('Dernière version chargée.');
  }catch(error){setError(error instanceof Error?error.message:'Chargement indisponible');}finally{setBusy(false);}
 }
 function sectionChanged(next:PageSection){if(content)setContent({...content,sections:content.sections.map(section=>section.id===next.id?next:section)});}
 function move(index:number,direction:number){
  if(!content)return;const sections=[...content.sections],target=index+direction;
  if(target<0||target>=sections.length)return;[sections[index],sections[target]]=[sections[target],sections[index]];setContent({...content,sections});
 }
 function addSection(){
  if(!content||content.sections.length>=12)return;
  const id=crypto.randomUUID(),title=pageSectionLabels[type];
  const section:PageSection=type==='image'?{id,type,title,imageUrl:'',alt:'',caption:'',layout:'wide',fit:'cover'}:type==='faq'?{id,type,title,items:[{question:'Votre question',answer:'Votre réponse'}]}:
   type==='benefits'?{id,type,title,items:['Votre point fort']}:
   type==='cta'?{id,type,title,text:'Invitez les visiteurs à découvrir vos produits.',label:'Voir les produits'}:
   {id,type,title,text:'Votre texte'};
  setContent({...content,sections:[...content.sections,section]});
 }
 return <><div className={styles.head}><div><h1>Pages de ma boutique</h1><p className={styles.muted}>Créez des pages de présentation, répondez aux questions et guidez vos visiteurs vers le catalogue.</p></div>
  <button type="button" className={styles.secondary} disabled={busy||mediaBusy} onClick={()=>void reload()}>Recharger les pages</button></div>
  {error&&<p role="alert" className={styles.error}>{error}</p>}{message&&<p role="status" className={styles.success}>{message}</p>}
  <div className={styles.grid}><aside className={styles.panel}><div className={styles.list} aria-label="Pages enregistrées">
   {pages.map(page=><button key={page.id} type="button" className={styles.pageButton} aria-pressed={page.id===selected} disabled={busy||mediaBusy} onClick={()=>choose(page)}>
    <strong>{page.draft.title}</strong><small>/{page.slug} · {page.publishedAt?'Publiée':'Brouillon'}</small></button>)}
   {!pages.length&&<p className={styles.muted}>Aucune page. Créez votre première présentation.</p>}
  </div><form className={styles.newPage} onSubmit={event=>{event.preventDefault();void create();}}><h2>Nouvelle page</h2>
   <label>Titre<input value={newTitle} onChange={event=>setNewTitle(event.target.value)} required maxLength={140} disabled={busy||mediaBusy}/></label>
   <label>Adresse courte<input value={newSlug} onChange={event=>setNewSlug(event.target.value)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={60} placeholder="a-propos" disabled={busy||mediaBusy}/></label>
   <small className={styles.muted}>Minuscules, chiffres et tirets. L’adresse ne change plus après création. {pages.length}/10 pages.</small>
   <button className={styles.primary} disabled={busy||mediaBusy||pages.length>=10}>Créer un brouillon</button>
  </form></aside>
  <section className={styles.panel}>{content&&row?<><p className={styles.status}>{row.publishedAt?'Une version est visible sur la boutique.':'Cette page n’est pas publiée.'} {dirty?'Modifications non enregistrées.':'Brouillon enregistré.'}</p>
   <fieldset disabled={busy||mediaBusy} style={{border:0,padding:0,margin:0,minWidth:0}}><div className={styles.form}>
    <label>Titre de la page<input value={content.title} maxLength={140} onChange={event=>setContent({...content,title:event.target.value})}/></label>
    <label>Description courte<textarea maxLength={160} value={content.description} onChange={event=>setContent({...content,description:event.target.value})}/></label>
    <label>Langue de la page<select value={content.language} onChange={event=>setContent({...content,language:event.target.value as 'fr'|'ar'})}><option value="fr">Français</option><option value="ar">العربية</option></select></label>
    <h2>Sections · {content.sections.length}/12</h2>
    {content.sections.map((section,index)=><div key={section.id} className={styles.sectionEditor}>
     <div className={styles.sectionHeading}><strong>{index+1}. {pageSectionLabels[section.type]}</strong><div className={styles.actions}>
      <button type="button" aria-label={'Monter la section '+(index+1)} disabled={index===0} onClick={()=>move(index,-1)}>↑</button>
      <button type="button" aria-label={'Descendre la section '+(index+1)} disabled={index===content.sections.length-1} onClick={()=>move(index,1)}>↓</button>
      <button type="button" disabled={content.sections.length===1} onClick={()=>setContent({...content,sections:content.sections.filter(item=>item.id!==section.id)})}>Retirer</button>
     </div></div>
     <label>Titre<input maxLength={140} value={section.title} onChange={event=>sectionChanged({...section,title:event.target.value})}/></label>
     {section.type==='image'&&<>
      <label>Image · lien HTTPS ou photo de la médiathèque<input dir="ltr" value={section.imageUrl} maxLength={2000} placeholder="https://…" onChange={event=>sectionChanged({...section,imageUrl:event.target.value})}/></label>
      <button type="button" className={styles.secondary} onClick={()=>setMediaSectionId(current=>current===section.id?null:section.id)}>{mediaSectionId===section.id?'Fermer la médiathèque':'Choisir ou importer une photo'}</button>
      {mediaSectionId===section.id&&<ProductMediaLibrary value={section.imageUrl} onBusyChange={setMediaBusy} onChoose={url=>chooseImage(row.id,section.id,url)}/>}
      {isSectionImageUrl(section.imageUrl)&&<img className={imageStyles.imagePreview} src={section.imageUrl} alt={section.alt||'Aperçu de l’image choisie'} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>}
      <label>Texte alternatif · décris le visuel<input dir="auto" value={section.alt} maxLength={220} onChange={event=>sectionChanged({...section,alt:event.target.value})}/></label>
      <label>Légende facultative<textarea dir="auto" value={section.caption} maxLength={500} onChange={event=>sectionChanged({...section,caption:event.target.value})}/></label>
      <label>Format du visuel<select value={section.layout} onChange={event=>sectionChanged({...section,layout:event.target.value as 'wide'|'square'|'portrait'})}><option value="wide">Paysage · 16:9</option><option value="square">Carré · 1:1</option><option value="portrait">Portrait · 3:4</option></select></label>
      <label>Affichage<select value={section.fit} onChange={event=>sectionChanged({...section,fit:event.target.value as 'cover'|'contain'})}><option value="cover">Recadrer pour remplir le cadre</option><option value="contain">Afficher l’image entière</option></select></label>
     </>}
     {(section.type==='hero'||section.type==='text'||section.type==='cta')&&<label>Texte<textarea maxLength={2500} value={section.text} onChange={event=>sectionChanged({...section,text:event.target.value})}/></label>}
     {section.type==='cta'&&<label>Texte du bouton vers le catalogue<input maxLength={60} value={section.label} onChange={event=>sectionChanged({...section,label:event.target.value})}/></label>}
     {section.type==='benefits'&&<>
      {section.items.map((item,itemIndex)=><div key={itemIndex} className={styles.repeated}><label>Point fort {itemIndex+1}<input maxLength={140} value={item} onChange={event=>sectionChanged({...section,items:section.items.map((value,i)=>i===itemIndex?event.target.value:value)})}/></label>
       <button type="button" className={styles.secondary} disabled={section.items.length===1} onClick={()=>sectionChanged({...section,items:section.items.filter((_,i)=>i!==itemIndex)})}>Retirer ce point</button></div>)}
      <button type="button" className={styles.secondary} disabled={section.items.length>=6} onClick={()=>sectionChanged({...section,items:[...section.items,'Nouveau point fort']})}>Ajouter un point fort</button>
     </>}
     {section.type==='faq'&&<>
      {section.items.map((item,itemIndex)=><div key={itemIndex} className={styles.repeated}>
       <label>Question {itemIndex+1}<input maxLength={140} value={item.question} onChange={event=>sectionChanged({...section,items:section.items.map((value,i)=>i===itemIndex?{...value,question:event.target.value}:value)})}/></label>
       <label>Réponse<textarea maxLength={2500} value={item.answer} onChange={event=>sectionChanged({...section,items:section.items.map((value,i)=>i===itemIndex?{...value,answer:event.target.value}:value)})}/></label>
       <button type="button" className={styles.secondary} disabled={section.items.length===1} onClick={()=>sectionChanged({...section,items:section.items.filter((_,i)=>i!==itemIndex)})}>Retirer cette question</button>
      </div>)}
      <button type="button" className={styles.secondary} disabled={section.items.length>=8} onClick={()=>sectionChanged({...section,items:[...section.items,{question:'Nouvelle question',answer:'Votre réponse'}]})}>Ajouter une question</button>
     </>}
    </div>)}
    <div className={styles.actions}><select aria-label="Type de section à ajouter" value={type} onChange={event=>setType(event.target.value as PageSection['type'])}>
     {Object.entries(pageSectionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select><button type="button" className={styles.secondary} disabled={content.sections.length>=12} onClick={addSection}>Ajouter une section</button></div>
   </div></fieldset>
   <div className={styles.actions} style={{marginTop:24}}>
    <button type="button" className={styles.primary} disabled={busy||mediaBusy||!dirty} onClick={()=>void change('save')}>Enregistrer le brouillon</button>
    <Link className={styles.secondary} href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/pages/'+row.id+'/apercu'} target="_blank" rel="noopener noreferrer">Aperçu enregistré ↗</Link>
    <button type="button" className={styles.primary} disabled={busy||mediaBusy||dirty} onClick={()=>void change('publish')}>Publier la version enregistrée</button>
    {row.publishedAt&&<><button type="button" className={styles.secondary} disabled={busy||mediaBusy||dirty} onClick={()=>void change('unpublish')}>Dépublier</button>
     <Link href={'/vitrines/'+encodeURIComponent(shopSlug)+'/pages/'+row.slug} target="_blank" rel="noopener noreferrer">Voir la page publique ↗</Link></>}
   </div><p className={styles.muted}>La publication nécessite une boutique publiée et un abonnement valide. Les pages sont ajoutées à la navigation de la boutique.</p>
   <button type="button" className={styles.secondary} disabled={busy||mediaBusy} onClick={()=>void remove()}>Supprimer la page</button>
   <ShopPageHistory key={row.id+':'+row.version} endpoint={endpoint+'/'+row.id} disabled={busy||mediaBusy||dirty} onRestore={id=>void change('restoreRevision',id)}/>
  </>:<p className={styles.muted}>Sélectionnez une page ou créez un brouillon pour commencer.</p>}</section></div>
 </>;
}
