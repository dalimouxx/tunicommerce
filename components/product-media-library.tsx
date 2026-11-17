'use client';
import {useCallback,useEffect,useRef,useState,type ChangeEvent} from 'react';
import {ImagePlus,Check,Trash2,RefreshCcw,ImageOff} from 'lucide-react';
import {compressProductPhoto} from '../modules/product-media/compress-client';
import styles from './product-media-library.module.css';
import {batchSummary,planPhotoBatch} from '../modules/product-media/batch';

type Photo={id:string;url:string;size:number;width:number;height:number;createdAt:string};
type Collection={photos:Photo[];limit:number};
type Props={value?:string;selected?:readonly string[];onChoose?:(url:string)=>void;standalone?:boolean;onBusyChange?:(pending:boolean)=>void};

export default function ProductMediaLibrary({value,selected,onChoose,standalone=false,onBusyChange}:Props){
 const isChosen=(url:string)=>selected?selected.includes(url):value===url;
 const [collection,setCollection]=useState<Collection>({photos:[],limit:30});
 const [pending,setPending]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [progress,setProgress]=useState<{done:number;total:number}|null>(null);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;onBusyChange?.(false);};},[onBusyChange]);
 useEffect(()=>{onBusyChange?.(pending);},[pending,onBusyChange]);

 const refresh=useCallback(async()=>{
  const response=await fetch('/api/v1/product-media',{cache:'no-store'});
  const data=await response.json() as Collection&{error?:string};
  if(!response.ok)throw new Error(data.error||'Chargement impossible');
  setCollection(data);
 },[]);

 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:'Erreur'))
  .finally(()=>setLoading(false));},[refresh]);

 /** Compresses and sends one photo; throws a readable error. */
 async function sendOne(file:File){
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const processed=await compressProductPhoto(file);
   const response=await fetch('/api/v1/product-media',{
    method:'PUT',headers:{'Content-Type':processed.type},body:processed,signal:controller.signal
   });
   const result=await response.json() as Photo&{error?:string};
   if(!response.ok)throw new Error(result.error||'Importation impossible');
   return result;
  }catch(e){throw new Error(controller.signal.aborted?'Importation trop lente. Réessaie avec une image plus légère.':e instanceof Error?e.message:'Importation indisponible');}
  finally{clearTimeout(timeout);}
 }
 /** Several photos at once: one after the other, the batch is cut to the free space; failures do not stop the others. */
 async function upload(files:File[]){
  if(pending||!files.length)return;
  const plan=planPhotoBatch(files.length,collection.photos.length,collection.limit);
  const accepted=files.slice(0,plan.accepted);
  setPending(true);setError('');setSuccess('');setProgress({done:0,total:accepted.length});
  const failed:string[]=[];let imported=0,last:Photo|null=null,lastError='';
  for(const file of accepted){
   try{last=await sendOne(file);imported++;}catch(e){failed.push(file.name);lastError=e instanceof Error?e.message:'';}
   if(!mounted.current)return;
   setProgress({done:imported+failed.length,total:accepted.length});
  }
  try{await refresh();}catch{}
  if(!mounted.current)return;
  if(files.length===1&&last){onChoose?.(last.url);setSuccess('Photo optimisée et enregistrée ('+Math.round(last.size/1024)+' Ko).');}
  else if(files.length===1)setError(lastError||'Importation indisponible');
  else{const text=batchSummary({imported,failed,skipped:plan.skipped},collection.limit);if(failed.length||!imported)setError(text);else setSuccess(text+(onChoose?' Cliquez sur une photo pour l’utiliser.':''));}
  setProgress(null);setPending(false);
 }

 async function removePhoto(id:string){
  if(pending)return;
  setPending(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/v1/product-media/'+id,{method:'DELETE'});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Suppression impossible');
   const removed=collection.photos.find(p=>p.id===id);
   if(removed?.url===value)onChoose?.('');
   await refresh();
   setSuccess('Photo inutilisée supprimée.');
  }catch(e){setError(e instanceof Error?e.message:'Suppression indisponible');}
  finally{setPending(false);}
 }

 function chooseFile(e:ChangeEvent<HTMLInputElement>){
  const files=[...(e.currentTarget.files||[])];
  e.currentTarget.value='';
  if(files.length)void upload(files);
 }

 return <div className={styles.panel}>
  <div className={styles.heading}>
   <div><strong>{standalone?'Ma bibliothèque de photos':'Photos de la boutique'}</strong>
    <small>{collection.photos.length}/{collection.limit} photos · Compression automatique · Maximum 400 Ko après optimisation</small>
   </div>
   <button type="button" className={styles.refresh} disabled={pending}
    onClick={()=>void refresh().catch(e=>setError(e instanceof Error?e.message:'Erreur'))}
    aria-label="Actualiser les photos"><RefreshCcw size={15}/></button>
  </div>
  <label className={styles.upload}>
   <ImagePlus size={17}/>
   {progress&&progress.total>1?'Importation '+progress.done+'/'+progress.total+'…':pending?'Traitement de l’image…':'Importer des photos (JPG, PNG ou WebP, plusieurs à la fois)'}
   <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={pending||collection.photos.length>=collection.limit}
    onChange={chooseFile}/>
  </label>
  <p className={styles.hint}>Depuis votre téléphone ou ordinateur · 12 Mo maximum avant optimisation · 1600 px recommandé. Une photo utilisée par un produit, un accueil, une page ou un historique conservé ne peut pas être supprimée.</p>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {success&&<p role="status" className={styles.success}>{success}</p>}
  {loading?<p className={styles.hint}>Chargement des photos…</p>:
   collection.photos.length?<div className={styles.gallery}>
    {collection.photos.map(photo=><div key={photo.id} className={styles.cell}>
     <button type="button" title={onChoose?'Utiliser cette photo':'Photo du catalogue'}
      disabled={pending||!onChoose}
      className={styles.thumbnail+' '+(isChosen(photo.url)?styles.chosen:'')} aria-pressed={selected?isChosen(photo.url):undefined}
      onClick={()=>onChoose?.(photo.url)}>
      <img src={photo.url} alt={'Photo du catalogue '+photo.createdAt.slice(0,10)} loading="lazy"/>
      {isChosen(photo.url)&&<span className={styles.check}><Check size={15}/></span>}
     </button>
     <div className={styles.meta}>
      <small>{Math.round(photo.size/1024)} Ko</small>
      <button type="button" title="Supprimer une photo inutilisée" aria-label="Supprimer cette photo"
       disabled={pending} onClick={()=>void removePhoto(photo.id)}><Trash2 size={15}/></button>
     </div>
    </div>)}
   </div>:<div className={styles.empty}><ImageOff size={25}/><p>Aucune photo importée. Ajoutez la première image de votre catalogue.</p></div>}
  {onChoose&&value&&!selected&&<button type="button" className={styles.clear} onClick={()=>onChoose('')}>Retirer cette photo de la sélection</button>}
 </div>;
}


