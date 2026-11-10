import type {CSSProperties,ReactNode} from 'react';
import type {Presentation} from '../modules/appearance/validation';
import styles from './storefront-theme.module.css';
import {appearanceAccentText,appearanceThemeDetails} from '../modules/appearance/theme-catalog';
import StorefrontMotionToggle from './storefront-motion-toggle';

export default function StorefrontTheme({
 appearance,children
}:{appearance:Presentation,children:ReactNode}){
 return <div className={styles.shell} data-theme={appearance.theme} data-motion-root
  style={{'--store-accent':appearance.accent,'--store-accent-text':appearanceAccentText(appearance.accent)} as CSSProperties}>
  {appearanceThemeDetails[appearance.theme].animated&&<div className={styles.motionBar}><StorefrontMotionToggle className={styles.motionButton}/></div>}
  {(appearance.theme!=='classic'||appearance.eyebrow!=='BOUTIQUE INDÉPENDANTE · TUNISIE'||appearance.tagline!=='Livraison en Tunisie · Paiement à la livraison')&&
   <div className={styles.announcement}>
    <span>{appearance.eyebrow||'UNE BOUTIQUE INDÉPENDANTE EN TUNISIE'}</span>
    <span aria-hidden="true">✦</span>
    <span>{appearance.tagline||'Paiement à la livraison · Tunisie'}</span>
   </div>}
  {children}
 </div>;
}
