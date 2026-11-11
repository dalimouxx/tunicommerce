'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useTransition} from 'react';
import type {shopLaunchReadiness} from '../../../modules/shops/shop-launch';
import styles from '../shops.module.css';
type Readiness=ReturnType<typeof shopLaunchReadiness>;
export default function ShopLaunchChecklist({readiness,shopId,initialized}:{readiness:Readiness;shopId:string;initialized:boolean}){
 const router=useRouter();const [pending,startTransition]=useTransition();
 const targets:Record<string,string>={initialize:'#initialisation-boutique',catalog:'#espace=catalog',subscription:'/mon-abonnement',identity:'#vitrine'};
 return <section className={styles.launchCard} aria-labelledby="shop-launch-title"><header className={styles.launchHeading}><div><span className={styles.kicker}>AVANT DE PARTAGER TON LIEN</span><h2 id="shop-launch-title">{readiness.publiclyAvailable?'Ta vitrine est en ligne.':readiness.ready?'Ta boutique est prête à être publiée.':'Prépare ta boutique, étape par étape.'}</h2><p>Les éléments requis protègent le bon démarrage de ta vitrine. Après un changement, actualise les étapes.</p></div><button className={styles.secondary} type="button" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}>{pending?'Actualisation…':'Actualiser les étapes'}</button></header>
  <ol className={styles.launchSteps}>{readiness.steps.map(step=><li key={step.id} data-done={step.done}><span className={styles.stepIcon} aria-hidden="true">{step.done?'✓':'○'}</span><div><strong>{step.title}</strong><small>{step.done?'Terminé':step.required?'Requis':'Recommandé'}</small></div>{!step.done&&<Link href={!initialized&&step.id!=='subscription'?'#initialisation-boutique':targets[step.id]}>{step.id==='subscription'?'Voir mon offre':'Continuer'} ↗</Link>}</li>)}</ol>
  {initialized&&<div className={styles.actions}><Link className={styles.secondary} href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/apercu'}>Ouvrir mon aperçu privé</Link>{readiness.ready&&!readiness.publiclyAvailable&&<Link className={styles.primary} href="#vitrine">Choisir ma publication</Link>}</div>}
 </section>;
}
