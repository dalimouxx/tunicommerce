'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Star,X} from 'lucide-react';
import ProductMediaLibrary from './product-media-library';
import {PRODUCT_PHOTO_LIMIT,arrangeGallery,type GalleryStep} from '../modules/product-media/gallery';
import styles from './product-photos-editor.module.css';

/** Ordered product photos: the first is the main photo used by cards, cart and sharing. */
export default function ProductPhotosEditor({value,onChange}:{value:readonly string[];onChange:(next:string[])=>void}){
 const [link,setLink]=useState('');
 const [message,setMessage]=useState('');
 const apply=(step:GalleryStep)=>{setMessage('');onChange(arrangeGallery(value,step));};
 const choose=(url:string)=>{
  if(!url)return;
  if(value.includes(url)){apply({type:'remove',index:value.indexOf(url)});return;}
  if(value.length>=PRODUCT_PHOTO_LIMIT){setMessage(PRODUCT_PHOTO_LIMIT+' photos maximum : retirez-en une avant d’en ajouter une autre.');return;}
  apply({type:'add',url});
 };
 const addLink=()=>{
  const url=link.trim();
  try{if(new URL(url).protocol!=='https:')throw Error();}catch{setMessage('Le lien doit commencer par https://');return;}
  choose(url);setLink('');
 };
 return <div className={styles.editor}>
  <div className={styles.heading}>
   <strong>Photos du produit</strong>
   <span aria-live="polite">{value.length}/{PRODUCT_PHOTO_LIMIT}</span>
  </div>
  <p className={styles.hint}>La première est la photo principale : elle apparaît dans le catalogue, le panier et les partages. Les autres s’affichent sur la page du produit.</p>
  {value.length>0?<ol className={styles.list}>{value.map((url,index)=><li key={url} className={styles.item}>
   <img src={url} alt={index===0?'Photo principale':'Photo '+(index+1)} referrerPolicy="no-referrer"/>
   {index===0&&<span className={styles.badge}>Principale</span>}
   <div className={styles.actions}>
    <button type="button" onClick={()=>apply({type:'move',index,by:-1})} disabled={index===0} aria-label={'Avancer la photo '+(index+1)}><ArrowLeft size={14}/></button>
    {index>0&&<button type="button" onClick={()=>apply({type:'main',index})} aria-label={'Mettre la photo '+(index+1)+' en principale'} title="Mettre en principale"><Star size={14}/></button>}
    <button type="button" onClick={()=>apply({type:'move',index,by:1})} disabled={index===value.length-1} aria-label={'Reculer la photo '+(index+1)}><ArrowRight size={14}/></button>
    <button type="button" onClick={()=>apply({type:'remove',index})} aria-label={'Retirer la photo '+(index+1)} className={styles.remove}><X size={14}/></button>
   </div>
  </li>)}</ol>:<p className={styles.empty}>Aucune photo. Choisissez-en dans la médiathèque ci-dessous.</p>}
  <div className={styles.link}>
   <input type="url" inputMode="url" maxLength={2000} value={link} onChange={e=>setLink(e.target.value)} placeholder="Ou ajouter un lien https://…" aria-label="Lien HTTPS d’une photo"
    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addLink();}}}/>
   <button type="button" onClick={addLink} disabled={!link.trim()}>Ajouter</button>
  </div>
  {message&&<p className={styles.message} role="status">{message}</p>}
  <p className={styles.hint}>Touchez une photo de la médiathèque pour l’ajouter, touchez-la à nouveau pour la retirer.</p>
  <ProductMediaLibrary value={value[0]} selected={value} onChoose={choose}/>
 </div>;
}
