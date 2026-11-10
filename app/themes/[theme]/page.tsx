import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {CSSProperties} from 'react';
import {storefrontThemeCodes,storefrontPalette,animatedStorefrontTheme} from '../../../modules/shops/storefront-themes';
import ProductScene from '../../../components/product-scene';
import StorefrontMotionToggle from '../../../components/storefront-motion-toggle';
import styles from '../../vitrines/[slug]/storefront-premium.module.css';
type Props={params:Promise<{theme:string}>};
export function generateStaticParams(){return storefrontThemeCodes.map(theme=>({theme}));}
function selected(code:string){if(!storefrontThemeCodes.includes(code as typeof storefrontThemeCodes[number]))notFound();return storefrontPalette(code);}
export async function generateMetadata({params}:Props){const theme=selected((await params).theme);return {title:theme.name+' · Démo de thème Tunicom',description:theme.description};}
export default async function ThemeDemo({params}:Props){
 const theme=selected((await params).theme),kind=theme.code==='SORBET'?'bottle':theme.code==='PULSE'||theme.code==='GROOVE'?'shoe':'audio';
 const vars={'--store-bg':theme.background,'--store-text':theme.foreground,'--store-accent':theme.accent,'--store-accent-text':theme.accentText,'--store-surface':theme.surface,'--store-muted':theme.muted} as CSSProperties;
 return <main className={styles.page} data-theme={theme.code} style={vars}>
  <aside className={styles.previewWarning}><strong>DÉMONSTRATION · THÈME {theme.name.toUpperCase()}</strong><span>Produits fictifs · Aucun achat sur cette page.</span><Link href="/decouvrir#themes">← Retour à Tunicom</Link></aside>
  <div className={styles.announcement}>NOUVELLE SAISON ✳ NOUVELLE ÉNERGIE ✳ TON UNIVERS</div>
  <div className={styles.container}><header className={styles.storeHeader}><Link className={styles.identity} href="/decouvrir#themes"><span className={styles.fallbackLogo}>{theme.name[0]}</span><span className={styles.brandText}><strong>{theme.name} Studio</strong><small>Démo Tunicom</small></span></Link>
   <nav className={styles.nav} aria-label="Navigation de démonstration"><a href="#catalogue">Collection</a>{animatedStorefrontTheme(theme.code)&&<StorefrontMotionToggle className={styles.motionControl}/>}<Link href="/inscription">Choisir ce style ↗</Link></nav></header>
   <section className={styles.hero}><div className={styles.heroCopy}><span className={styles.kicker}>NOUVELLE COLLECTION / 01</span><h1>{theme.code==='PULSE'?'Fais du bruit.':theme.code==='SORBET'?'Un quotidien plus doux.':theme.code==='CHROME'?'Le son prend forme.':theme.code==='GROOVE'?'Sors du cadre.':'Ton style. Ton univers.'}</h1>
    <p className={styles.heroDescription}>Des essentiels qui font la différence. Explore cette mise en scène et imagine ta propre collection.</p><div className={styles.heroActions}><a className={styles.primaryAction} href="#catalogue">Explorer la collection ↗</a></div><div className={styles.heroCategories}><span>Design affirmé</span><span>Énergie créative</span></div></div>
    <div className={styles.heroVisual}><div className={styles.demoScene}><ProductScene kind={kind}/></div><div className={styles.featuredBadge}><span>LE CHOIX DU STUDIO</span><strong>Une pièce. Tout un univers.</strong><small>Produit de démonstration</small></div></div></section>
   <section className={styles.pillars} aria-label="Fonctions des boutiques"><div><span>✧</span><strong>Ton identité</strong><small>Une vitrine qui te ressemble</small></div><div><span>◈</span><strong>Sur mobile aussi</strong><small>Une mise en page qui s’adapte</small></div><div><span>✦</span><strong>Ton catalogue</strong><small>Produits, variantes et prix</small></div></section>
   <section className={styles.catalogue} id="catalogue"><div className={styles.sectionHeading}><div><span className={styles.kicker}>LE DROP DU MOMENT</span><h2>La sélection du studio.</h2></div><p>Exemples visuels · Produits non commercialisés</p></div>
    <div className={styles.productGrid}>{(['audio','shoe','bottle'] as const).map((item,index)=><article className={styles.productCard} key={item}><div className={styles.productImageWrap}><div className={styles.demoProduct}><ProductScene kind={item}/></div></div><div className={styles.productBody}><small>ÉDITION STUDIO / 0{index+1}</small><h3>{['Le son essentiel','La paire signature','Le rituel quotidien'][index]}</h3><p>Exemple de fiche produit</p><Link className={styles.primaryAction} href="/inscription">Créer ma boutique ↗</Link></div></article>)}</div>
   </section><footer className={styles.footer}><strong>{theme.name} Studio · Démonstration Tunicom</strong><Link href="/decouvrir#themes">Explorer les autres styles ↗</Link></footer>
  </div>
 </main>;
}
