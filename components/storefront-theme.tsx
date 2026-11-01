import type {CSSProperties,ReactNode} from 'react';
import type {Presentation} from '../modules/appearance/validation';
import styles from './storefront-theme.module.css';

export default function StorefrontTheme({
 appearance,children
}:{appearance:Presentation,children:ReactNode}){
 return <div className={styles.shell} data-theme={appearance.theme}
  style={{'--store-accent':appearance.accent} as CSSProperties}>
  {(appearance.theme!=='classic'||appearance.eyebrow!=='BOUTIQUE INDÉPENDANTE · TUNISIE'||appearance.tagline!=='Livraison en Tunisie · Paiement à la livraison')&&
   <div className={styles.announcement}>
    <span>{appearance.eyebrow||'UNE BOUTIQUE INDÉPENDANTE EN TUNISIE'}</span>
    <span aria-hidden="true">✦</span>
    <span>{appearance.tagline||'Paiement à la livraison · Tunisie'}</span>
   </div>}
  {children}
 </div>;
}
