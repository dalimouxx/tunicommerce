'use client';
import {useState} from 'react';
import {Pause,Play} from 'lucide-react';
export default function StorefrontMotionToggle({className,lang='fr'}:{className?:string;lang?:'fr'|'ar'}){
 const [paused,setPaused]=useState(false);
 return <button type="button" className={className} aria-pressed={paused}
  aria-label={lang==='ar'?(paused?'تشغيل الحركة':'إيقاف الحركة مؤقتاً'):(paused?'Reprendre les animations':'Mettre les animations en pause')}
  onClick={event=>{const next=!paused;setPaused(next);(event.currentTarget.closest('[data-motion-root]')||event.currentTarget.closest('main'))?.setAttribute('data-motion',next?'paused':'playing');}}>
  {paused?<Play size={15}/>:<Pause size={15}/>}<span>{lang==='ar'?(paused?'تشغيل الحركة':'إيقاف الحركة'):(paused?'Reprendre les animations':'Mettre en pause')}</span>
 </button>;
}
