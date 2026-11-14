import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {CSSProperties} from 'react';
import {storefrontThemeCodes,storefrontPalette,animatedStorefrontTheme} from '../../../modules/shops/storefront-themes';
import ProductScene from '../../../components/product-scene';
import StorefrontMotionToggle from '../../../components/storefront-motion-toggle';
import StorefrontReveal from '../../../components/storefront-reveal';
import motion from '../../../components/storefront-motion.module.css';
import ThemeMotif from '../../../components/theme-motif';
import ThemeHeroExtras from '../../../components/theme-hero-extras';
import {themeClass} from '../../../components/storefront-themes';
import {storefrontLayout} from '../../../modules/shops/theme-layouts';
import {formatStorefrontMoney,storefrontDictionary} from '../../../modules/shops/storefront-i18n';

const titles:Record<string,string>={PULSE:'Fais du bruit.',SORBET:'Un quotidien plus doux.',CHROME:'Le son prend forme.',GROOVE:'Sors du cadre.',
 MEDINA:'L’artisanat, en lumière.',SAHARA:'La chaleur du désert.',BENTO:'Tout. Simplement.',SOUK:'Les bons plans du souk.',AURORA:'Ta routine, en couleur.',MAGAZINE:'Le style, en grand.'};
const kinds:Record<string,'audio'|'shoe'|'bottle'>={SORBET:'bottle',PULSE:'shoe',GROOVE:'shoe',MEDINA:'bottle',SAHARA:'bottle',AURORA:'bottle',BENTO:'audio',SOUK:'shoe',MAGAZINE:'shoe'};
/** Fictional demo items; the quantity offer only illustrates how real offers are displayed. */
const demoProducts=[
 {id:'audio',name:'Le son essentiel',price:189000,available:true,offers:[] as {quantity:number;price:number;label:string}[]},
 {id:'shoe',name:'La paire signature',price:149000,available:true,offers:[{quantity:2,price:269000,label:'Duo'}]},
 {id:'bottle',name:'Le rituel quotidien',price:59000,available:true,offers:[{quantity:3,price:149000,label:'Trio'}]}
];
import styles from '../../vitrines/[slug]/storefront-premium.module.css';
type Props={params:Promise<{theme:string}>};
export function generateStaticParams(){return storefrontThemeCodes.map(theme=>({theme}));}
function selected(code:string){if(!storefrontThemeCodes.includes(code as typeof storefrontThemeCodes[number]))notFound();return storefrontPalette(code);}
export async function generateMetadata({params}:Props){const theme=selected((await params).theme);return {title:theme.name+' · Démo de thème Tunicom',description:theme.description};}
export default async function ThemeDemo({params}:Props){
 const theme=selected((await params).theme),kind=kinds[theme.code]||'audio',layout=storefrontLayout(theme.code),t=storefrontDictionary('fr');
 const vars={'--store-bg':theme.background,'--store-text':theme.foreground,'--store-accent':theme.accent,'--store-accent-text':theme.accentText,'--store-surface':theme.surface,'--store-muted':theme.muted} as CSSProperties;
 return <main className={[styles.page,motion.root,themeClass(theme.code)].filter(Boolean).join(' ')} data-motion-root data-theme={theme.code} data-hero={layout.hero} data-cards={layout.cards} data-motif={layout.motif} style={vars}>
  <StorefrontReveal/>
  <aside className={styles.previewWarning}><strong>DÉMONSTRATION · THÈME {theme.name.toUpperCase()}</strong><span>Produits fictifs · Aucun achat sur cette page.</span><Link href="/decouvrir#themes">← Retour à Tunicom</Link></aside>
  <div className={styles.announcement} data-part="announcement">NOUVELLE SAISON ✳ NOUVELLE ÉNERGIE ✳ TON UNIVERS</div>
  <div className={styles.container}><header className={styles.storeHeader} data-part="header"><Link className={styles.identity} href="/decouvrir#themes"><span className={styles.fallbackLogo}>{theme.name[0]}</span><span className={styles.brandText}><strong>{theme.name} Studio</strong><small>Démo Tunicom</small></span></Link>
   <nav className={styles.nav} aria-label="Navigation de démonstration"><a href="#catalogue">Collection</a>{animatedStorefrontTheme(theme.code)&&<StorefrontMotionToggle className={styles.motionControl}/>}<Link href="/inscription">Choisir ce style ↗</Link></nav></header>
   <section className={styles.hero} data-part="hero"><ThemeMotif motif={layout.motif}/><div className={styles.heroCopy} data-part="hero-copy"><span className={styles.kicker}>NOUVELLE COLLECTION / 01</span><h1>{titles[theme.code]||'Ton style. Ton univers.'}</h1>
    <p className={styles.heroDescription}>Des essentiels qui font la différence. Explore cette mise en scène et imagine ta propre collection.</p><div className={styles.heroActions}><a className={styles.primaryAction} data-part="cta" href="#catalogue">Explorer la collection ↗</a></div><div className={styles.heroCategories}><span>Design affirmé</span><span>Énergie créative</span></div></div>
    <div className={styles.heroVisual} data-part="hero-visual"><div className={styles.demoScene}><ProductScene kind={kind}/></div><div className={styles.featuredBadge} data-part="featured-badge"><span>LE CHOIX DU STUDIO</span><strong>Une pièce. Tout un univers.</strong><small>Produit de démonstration</small></div><ThemeHeroExtras layout={layout} products={demoProducts} categories={['Audio','Sneakers','Soins']} lang="fr" shopPath="" hrefFor={()=>'#catalogue'}/></div></section>
   <section className={styles.pillars} data-part="pillars" data-reveal aria-label="Fonctions des boutiques"><div><span>✧</span><strong>Ton identité</strong><small>Une vitrine qui te ressemble</small></div><div><span>◈</span><strong>Sur mobile aussi</strong><small>Une mise en page qui s’adapte</small></div><div><span>✦</span><strong>Ton catalogue</strong><small>Produits, variantes et prix</small></div></section>
   <section className={styles.catalogue} id="catalogue"><div className={styles.sectionHeading}><div><span className={styles.kicker}>LE DROP DU MOMENT</span><h2>La sélection du studio.</h2></div><p>Exemples visuels · Produits non commercialisés</p></div>
    <div className={styles.productGrid} data-part="product-grid">{(['audio','shoe','bottle'] as const).map((item,index)=><article className={styles.productCard} data-part="product-card" data-reveal style={{'--i':index} as CSSProperties} key={item}><div className={styles.productImageWrap} data-part="product-media"><div className={styles.demoProduct}><ProductScene kind={item}/></div></div><div className={styles.productBody}><small>ÉDITION STUDIO / 0{index+1}</small><h3>{['Le son essentiel','La paire signature','Le rituel quotidien'][index]}</h3><p>Exemple de fiche produit</p><p className={styles.productPrice}>{formatStorefrontMoney(demoProducts[index].price,'fr')}</p>{demoProducts[index].offers.length>0&&<p data-part="offer-badge">{t.offerBadge(demoProducts[index].offers[0].quantity,formatStorefrontMoney(demoProducts[index].offers[0].price,'fr'))}</p>}<Link className={styles.primaryAction} data-part="cta" href="/inscription">Créer ma boutique ↗</Link></div></article>)}</div>
   </section><footer className={styles.footer} data-part="footer" data-reveal><strong>{theme.name} Studio · Démonstration Tunicom</strong><Link href="/decouvrir#themes">Explorer les autres styles ↗</Link></footer>
  </div>
 </main>;
}
