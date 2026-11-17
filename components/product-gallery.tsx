'use client';
import {useRef,useState,type KeyboardEvent} from 'react';
import styles from './product-gallery.module.css';

type Props={images:readonly string[];alts:readonly string[];thumbLabels:readonly string[];label:string};
/** Swipe or scroll between photos (works without JS); thumbnails jump to a photo and show which one is visible. */
export default function ProductGallery({images,alts,thumbLabels,label}:Props){
 const track=useRef<HTMLDivElement>(null);
 const [active,setActive]=useState(0);
 const show=(index:number)=>{
  const element=track.current;if(!element)return;
  const target=Math.max(0,Math.min(images.length-1,index));
  const direction=getComputedStyle(element).direction==='rtl'?-1:1;
  const smooth=!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&!element.closest('[data-motion="paused"]');
  element.scrollTo({left:direction*target*element.clientWidth,behavior:smooth?'smooth':'auto'});
  setActive(target);
 };
 const onScroll=()=>{
  const element=track.current;if(!element||!element.clientWidth)return;
  setActive(Math.max(0,Math.min(images.length-1,Math.round(Math.abs(element.scrollLeft)/element.clientWidth))));
 };
 const onKey=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
  event.preventDefault();
  const rtl=getComputedStyle(event.currentTarget).direction==='rtl';
  show(active+((event.key==='ArrowRight')!==rtl?1:-1));
 };
 return <div className={styles.gallery} data-part="product-gallery">
  <div ref={track} className={styles.track} onScroll={onScroll} onKeyDown={onKey} tabIndex={0} role="region" aria-label={label}>
   {images.map((src,index)=><div key={src} className={styles.slide} aria-hidden={index!==active||undefined}>
    <img src={src} alt={alts[index]} loading={index===0?'eager':'lazy'} decoding="async" referrerPolicy="no-referrer" draggable={false}/>
   </div>)}
  </div>
  <div className={styles.thumbs}>
   {images.map((src,index)=><button key={src} type="button" className={styles.thumb} aria-current={index===active} aria-label={thumbLabels[index]} onClick={()=>show(index)}>
    <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>
   </button>)}
  </div>
 </div>;
}
