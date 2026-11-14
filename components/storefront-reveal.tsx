'use client';
import {useEffect,useRef} from 'react';

/** Hides only off-screen [data-reveal] elements present at mount, shows them as they scroll in, and flags the root once scrolled. */
export default function StorefrontReveal(){
 const marker=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  const root=marker.current?.closest<HTMLElement>('[data-motion-root]');
  if(!root)return;
  const items=[...root.querySelectorAll<HTMLElement>('[data-reveal]')];
  const onScroll=()=>{if(window.scrollY>24)root.setAttribute('data-scrolled','');else root.removeAttribute('data-scrolled');};
  onScroll();
  window.addEventListener('scroll',onScroll,{passive:true});
  if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   return ()=>window.removeEventListener('scroll',onScroll);
  }
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){entry.target.setAttribute('data-reveal','shown');observer.unobserve(entry.target);}
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  for(const item of items){
   const box=item.getBoundingClientRect();
   if(box.top<window.innerHeight&&box.bottom>0)continue;
   item.setAttribute('data-reveal','pending');observer.observe(item);
  }
  root.setAttribute('data-reveal-ready','');
  return ()=>{observer.disconnect();window.removeEventListener('scroll',onScroll);};
 },[]);
 return <span ref={marker} hidden/>;
}
