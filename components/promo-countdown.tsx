'use client';
import {useEffect,useState} from 'react';

const pad=(value:number)=>String(value).padStart(2,'0');
/** Real remaining time until endsAt; never invented. Seconds appear only during the last hour. */
export function countdownText(endsAt:string,now:Date,lang:'fr'|'ar'){
 const left=Date.parse(endsAt)-now.getTime();
 if(!(left>0))return lang==='ar'?'انتهى العرض':'Promotion terminée';
 const days=Math.floor(left/86400_000),hours=Math.floor(left%86400_000/3600_000),minutes=Math.floor(left%3600_000/60_000),seconds=Math.floor(left%60_000/1000);
 const parts=days>0?[days+(lang==='ar'?' ي ':' j '),pad(hours)+(lang==='ar'?' س ':' h '),pad(minutes)+(lang==='ar'?' د':' min')]:
  hours>0?[hours+(lang==='ar'?' س ':' h '),pad(minutes)+(lang==='ar'?' د':' min')]:[minutes+(lang==='ar'?' د ':' min '),pad(seconds)+(lang==='ar'?' ث':' s')];
 return (lang==='ar'?'ينتهي العرض بعد ':'Se termine dans ')+parts.join('');
}
/** Client-only ticking text (empty on the server to avoid hydration mismatches). */
export default function PromoCountdown({endsAt,lang}:{endsAt:string;lang:'fr'|'ar'}){
 const [text,setText]=useState('');
 useEffect(()=>{
  const tick=()=>setText(countdownText(endsAt,new Date(),lang));
  tick();const timer=window.setInterval(tick,1000);
  return ()=>window.clearInterval(timer);
 },[endsAt,lang]);
 return <span data-part="promo-countdown" aria-live="off">{text}</span>;
}
