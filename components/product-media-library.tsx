'use client';
import {useCallback,useEffect,useState,type ChangeEvent} from 'react';
import {ImagePlus,Check,Trash2,RefreshCcw,ImageOff} from 'lucide-react';
import {compressProductPhoto} from '../modules/product-media/compress-client';
import styles from './product-media-library.module.css';

type Photo={id:string;url:string;size:number;width:number;height:number;createdAt:string};
type Collection={photos:Photo[];limit:number};
type Props={value?:string;onChoose?:(url:string)=>void;standalone?:boolean};

export default function ProductMediaLibrary({value,onChoose,standalone=false}:Props){
 const [collection,setCollection]=useState<Collection>({photos:[],limit:30});
 const [pending,setPending]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');

 const refresh=useCallback(async()=>{
  const response=await fetch('/api/v1/product-media',{cache:'no-store'});
  const data=await response.json() as Collection&{error?:string};
  if(!response.ok)throw new Error(data.error||'Chargement impossible');
  setCollection(data);
 },[]);

 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:'Erreur'))
  .finally(()=>setLoading(false));},[refresh]);

 async function upload(file:File){
  if(pending)return;
  setPending(true);setError('');setSuccess('');
  try{
   const processed=await compressProductPhoto(file);
   const response=await fetch('/api/v1/product-media',{
    method:'PUT',headers:{'Content-Type':processed.type},body:processed
   });
   const result=await response.json() as Photo&{error?:string};
   if(!response.ok)throw new Error(result.error||'Importation impossible');
   onChoose?.(result.url);
   await refresh();
   setSuccess('Photo optimisée et enregistrée ('+Math.round(result.size/1024)+' Ko).');
  }catch(e){setError(e instanceof Error?e.message:'Importation indisponible');}
  finally{setPending(false);}
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
  const file=e.currentTarget.files?.[0];
  e.currentTarget.value='';
  if(file)void upload(file);
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
   {pending?'Traitement de l’image…':'Importer une photo (JPG, PNG ou WebP)'}
   <input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending||collection.photos.length>=collection.limit}
    onChange={chooseFile}/>
  </label>
  <p className={styles.hint}>Depuis votre téléphone ou ordinateur · 12 Mo maximum avant optimisation · 1600 px recommandé. Une photo utilisée par un produit ne peut pas être supprimée.</p>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {success&&<p role="status" className={styles.success}>{success}</p>}
  {loading?<p className={styles.hint}>Chargement des photos…</p>:
   collection.photos.length?<div className={styles.gallery}>
    {collection.photos.map(photo=><div key={photo.id} className={styles.cell}>
     <button type="button" title={onChoose?'Utiliser cette photo':'Photo du catalogue'}
      disabled={pending||!onChoose}
      className={styles.thumbnail+' '+(value===photo.url?styles.chosen:'')}
      onClick={()=>onChoose?.(photo.url)}>
      <img src={photo.url} alt={'Photo du catalogue '+photo.createdAt.slice(0,10)} loading="lazy"/>
      {value===photo.url&&<span className={styles.check}><Check size={15}/></span>}
     </button>
     <div className={styles.meta}>
      <small>{Math.round(photo.size/1024)} Ko</small>
      <button type="button" title="Supprimer une photo inutilisée" aria-label="Supprimer cette photo"
       disabled={pending} onClick={()=>void removePhoto(photo.id)}><Trash2 size={15}/></button>
     </div>
    </div>)}
   </div>:<div className={styles.empty}><ImageOff size={25}/><p>Aucune photo importée. Ajoutez la première image de votre catalogue.</p></div>}
  {onChoose&&value&&<button type="button" className={styles.clear} onClick={()=>onChoose('')}>Retirer la photo de ce produit</button>}
 </div>;
}
