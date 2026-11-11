import type {CSSProperties,ReactNode} from 'react';
import type {Presentation} from '../modules/appearance/validation';
import styles from './storefront-theme.module.css';
import {appearanceAccentText,appearanceThemeDetails} from '../modules/appearance/theme-catalog';
import StorefrontMotionToggle from './storefront-motion-toggle';

export default function StorefrontTheme({
 appearance,children,announcement
}:{appearance:Presentation,children:ReactNode;announcement?:string}){
 return <div className={styles.shell} data-theme={appearance.theme} data-motion-root
  style={{'--store-accent':appearance.accent,'--store-accent-text':appearanceAccentText(appearance.accent)} as CSSProperties}>
  {appearanceThemeDetails[appearance.theme].animated&&<div className={styles.motionBar}><StorefrontMotionToggle className={styles.motionButton}/></div>}
  {(announcement||appearance.theme!=='classic'||appearance.eyebrow!=='BOUTIQUE INDÉPENDANTE · TUNISIE'||appearance.tagline!=='Livraison en Tunisie · Paiement à la livraison')&&
   <div className={styles.announcement}>
    {announcement?<span dir="auto">{announcement}</span>:<><span>{appearance.eyebrow||'UNE BOUTIQUE INDÉPENDANTE EN TUNISIE'}</span>
    <span aria-hidden="true">✦</span>
    <span>{appearance.tagline||'Paiement à la livraison · Tunisie'}</span></>}
   </div>}
  {children}
 </div>;
}
