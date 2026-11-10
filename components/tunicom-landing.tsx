'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ArrowRight,Check,Package,ShoppingBag,MousePointer2,Layers,Menu,X,Pause,Play,Truck,ShieldCheck,Globe,Plus} from 'lucide-react';
import ProductScene from './product-scene';
import {storefrontPalette} from '../modules/shops/storefront-themes';
import styles from './tunicom-landing.module.css';

const newThemes=[{code:'PULSE',name:'Pulse',tag:'Pour les marques qui osent.',shop:'OFFBEAT',title:'MAKE SOME NOISE.',kind:'shoe'},
 {code:'SORBET',name:'Sorbet',tag:'Un peu de douceur. Beaucoup de style.',shop:'DAILY / CLUB',title:'GOOD SKIN. GOOD MOOD.',kind:'bottle'},
 {code:'CHROME',name:'Chrome',tag:'La tech, avec un temps d’avance.',shop:'FREQUENCY',title:'FEEL EVERY BEAT.',kind:'audio'},
 {code:'GROOVE',name:'Groove',tag:'Une autre idée du quotidien.',shop:'ODD STUDIO',title:'STAY A LITTLE DIFFERENT.',kind:'shoe'}] as const;
const questions=[
 ['Est-ce que je dois savoir coder ?','Tu peux créer ta boutique, choisir un thème et gérer tes produits depuis ton espace marchand. Les pages se composent avec des sections que tu ajoutes et réordonnes.'],
 ['Comment fonctionne le paiement à la livraison ?','Le client passe sa commande sur ta boutique. Tu retrouves la commande dans ton espace pour la confirmer, préparer l’expédition et suivre les montants COD enregistrés.'],
 ['Puis-je changer le design de ma boutique ?','Oui. Les thèmes se prévisualisent avant leur enregistrement. Changer de thème conserve tes produits, tes stocks et tes commandes.'],
 ['Les paiements en ligne et les transporteurs sont-ils connectés ?','Ces connexions attendent le choix et la configuration des prestataires. Le suivi des commandes et la gestion manuelle restent disponibles ; les intégrations non configurées sont indiquées comme telles.'],
 ['Comment choisir ma formule ?','Crée ton compte pour découvrir les offres disponibles et leurs limites depuis ton espace. Les conditions et moyens de règlement sont ceux affichés dans ton abonnement.']
];

export default function TunicomLanding(){
 const [selected,setSelected]=useState(0),[menu,setMenu]=useState(false),[paused,setPaused]=useState(false);
 const root=useRef<HTMLElement>(null),theme=newThemes[selected],palette=storefrontPalette(theme.code);
 useEffect(()=>{
  const elements=root.current?.querySelectorAll<HTMLElement>('[data-reveal]');
  if(!elements||!('IntersectionObserver' in window))return;
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.setAttribute('data-visible','true');observer.unobserve(entry.target);}},{threshold:.12});
  for(const element of elements)observer.observe(element);return()=>observer.disconnect();
 },[]);
 return <main ref={root} className={styles.root} data-paused={paused}>
  <a href="#contenu" className={styles.skip}>Aller au contenu</a>
  <header className={styles.header}><Link href="/decouvrir" className={styles.logo} aria-label="Tunicom, accueil"><span className={styles.logoMark} aria-hidden="true">t.</span>tunicom<span className={styles.logoDot}></span></Link>
   <nav className={styles.desktopNav} aria-label="Navigation principale"><a href="#pourquoi">Pourquoi Tunicom</a><a href="#themes">Les thèmes <span>Nouveau</span></a><a href="#comment">Comment ça marche</a></nav>
   <div className={styles.headerActions}><button type="button" className={styles.motion} aria-pressed={paused} aria-label={paused?'Reprendre les animations':'Mettre les animations en pause'} onClick={()=>setPaused(!paused)}>{paused?<Play size={16}/>:<Pause size={16}/>}</button>
    <Link href="/connexion/boutique" className={styles.login}>Connexion</Link><Link href="/inscription" className={styles.smallCta}>C’est parti <ArrowUpRight size={17}/></Link>
    <button type="button" className={styles.menuButton} aria-label={menu?'Fermer le menu':'Ouvrir le menu'} aria-expanded={menu} aria-controls="landing-menu" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
   </div>
  </header>
  {menu&&<nav id="landing-menu" className={styles.mobileNav} aria-label="Navigation mobile"><a href="#pourquoi" onClick={()=>setMenu(false)}>Pourquoi Tunicom</a><a href="#themes" onClick={()=>setMenu(false)}>Les thèmes</a><a href="#comment" onClick={()=>setMenu(false)}>Comment ça marche</a><Link href="/connexion/boutique">Connexion</Link></nav>}
  <section id="contenu" className={styles.hero}>
   <div className={styles.heroCopy}><p className={styles.eyebrow}><span/> LE COMMERCE A UNE NOUVELLE ÉNERGIE.</p>
    <h1>Ton business.<br/>Tes règles.<br/><span>Let’s go<span className={styles.star} aria-hidden="true">✳</span></span></h1>
    <p className={styles.heroDescription}>Une boutique qui te ressemble. Des commandes bien gérées. Et toute la place pour tes grandes idées.</p>
    <div className={styles.heroActions}><Link href="/inscription" className={styles.primary}>Lancer ma boutique <ArrowUpRight size={22}/></Link><a href="#themes" className={styles.textLink}>Trouver mon style <ArrowRight size={18}/></a></div>
    <div className={styles.heroNotes}><span><Check size={15}/> Sans code</span><span><Check size={15}/> Pensé pour la Tunisie</span><span lang="ar" dir="rtl">بالعربي زادة</span></div>
   </div>
   <div className={styles.heroStage} aria-label="Démonstration d’une boutique et de la gestion des commandes">
    <div className={styles.stageGrid}/><span className={styles.orbit} aria-hidden="true"/><span className={styles.stageAsterisk} aria-hidden="true">✳</span>
    <div className={styles.shopMock}><div className={styles.browserBar}><span/><span/><span/><small>BOUTIQUE DÉMO</small><Globe size={13}/></div>
     <div className={styles.mockHeader}><b>FREQUENCY</b><span>THE EVERYDAY DROP <ShoppingBag size={16}/></span></div>
     <div className={styles.mockProduct}><span className={styles.productKicker}>TURN IT UP.</span><ProductScene/><span className={styles.roundSticker}>SOUND<br/>ON ↗</span></div>
     <div className={styles.mockProductInfo}><div><small>LE SON. LE STYLE.</small><h2>Un casque. Ton univers.</h2></div><span className={styles.mockPrice}>129<span>,000 TND</span></span></div>
     <span className={styles.mockBuy}>DÉCOUVRIR LE DROP <ArrowUpRight size={17}/></span>
    </div>
    <div className={styles.orderToast}><span className={styles.toastIcon}><ShoppingBag size={20}/></span><div><strong>Et une nouvelle commande !</strong><small>Exemple de notification · 129,000 TND</small></div><span className={styles.toastDot}/></div>
    <div className={styles.stockNote}><Package size={22}/><span>Ton stock.<br/><b>Toujours sous les yeux.</b></span></div>
    <div className={styles.cursor}><MousePointer2 size={24} fill="currentColor"/><span>C’est ta marque.</span></div>
    <p className={styles.demoCaption}>Interface et produits de démonstration</p>
   </div>
  </section>
  <div className={styles.ticker} aria-label="Créer, vendre, gérer, recommencer"><div aria-hidden="true">{[0,1].map(copy=><span key={copy}>CRÉE TON UNIVERS <i>✳</i> VENDS À TA FAÇON <i>✳</i> GARDE LE CONTRÔLE <i>✳</i> FAIS BOUGER LES LIGNES <i>✳</i> </span>)}</div></div>
  <section id="pourquoi" className={styles.features} data-reveal>
   <div className={styles.sectionIntro}><p className={styles.eyebrow}>MOINS DE DISPERSION. PLUS D’ACTION.</p><h2>Les idées sont à toi.<br/>Les outils sont ici.</h2><p>De la première fiche produit au suivi de tes commandes, ton commerce trouve enfin son espace.</p></div>
   <div className={styles.bento}>
    <article className={styles.designCard}><span className={styles.cardNumber}>01 / TON IMAGE</span><h3>Une marque.<br/>Pas un copier-coller.</h3><p>Choisis ton thème, crée tes pages et donne le ton.</p><div className={styles.colorStack} aria-hidden="true"><span>Aa<span>STUDIO 01</span></span><span>✳<span>MAKE IT YOURS</span></span><span>t.<span>TON UNIVERS.</span></span></div><Layers className={styles.cardIcon}/></article>
    <article className={styles.ordersCard}><span className={styles.cardNumber}>02 / TON QUOTIDIEN</span><h3>Du premier clic<br/>au colis préparé.</h3><p>Commandes, confirmation, stock et suivi COD dans ton espace marchand.</p><div className={styles.orderSteps}><span><Check size={14}/> Commande reçue</span><span><Package size={14}/> En préparation</span><span><Truck size={14}/> Suivi de livraison</span></div></article>
    <article className={styles.teamCard}><span className={styles.cardNumber}>03 / TON ORGANISATION</span><h3>Un espace pour chaque rôle.</h3><p>Invite ton équipe et garde les accès de chaque boutique bien séparés.</p><div className={styles.rolePills}><span><ShieldCheck size={15}/> Propriétaire</span><span>Stock</span><span>Confirmation</span></div></article>
   </div>
  </section>
  <section id="themes" className={styles.themes} data-reveal>
   <div className={styles.themeIntro}><p className={styles.eyebrow}>TUNICOM STUDIO / 14 THÈMES</p><h2>Du style.<br/><span>Et du mouvement.</span></h2><p>Quatre nouveaux univers pour les marques qui ne veulent pas passer inaperçues. Essaie, explore, trouve ton énergie.</p>
    <div className={styles.themeTabs} role="group" aria-label="Choisir un aperçu de thème">{newThemes.map((item,index)=><button key={item.code} type="button" aria-pressed={selected===index} onClick={()=>setSelected(index)}>{item.name}<ArrowUpRight size={14}/></button>)}</div>
    <p className={styles.themeTag} aria-live="polite">{theme.tag}</p><Link className={styles.textLink} href={'/themes/'+theme.code}>Explorer le thème {theme.name} <ArrowUpRight size={19}/></Link>
   </div>
   <div className={styles.themePreview} data-demo-theme={theme.code} style={{background:palette.background,color:palette.foreground,'--demo-accent':palette.accent,'--demo-surface':palette.surface} as React.CSSProperties}>
    <div className={styles.previewNav}><b>{theme.shop}</b><span>SHOP <ShoppingBag size={15}/></span></div>
    <div className={styles.previewBody}><div><small>NEW SEASON / NEW ENERGY</small><h3>{theme.title}</h3><span className={styles.previewButton} style={{background:palette.accent,color:palette.accentText}}>DÉCOUVRIR <ArrowUpRight size={16}/></span></div><div className={styles.previewArt}><ProductScene kind={theme.kind}/></div></div>
    <div className={styles.previewBottom}><span>TA MARQUE. TON MOUVEMENT.</span><span>{theme.name} / DÉMO</span></div>
   </div>
  </section>
  <section id="comment" className={styles.how} data-reveal><div className={styles.sectionIntro}><p className={styles.eyebrow}>DE L’IDÉE À LA BOUTIQUE</p><h2>Trois étapes.<br/>Un nouveau départ.</h2></div>
   <div className={styles.steps}>{[['01','Pose les bases.','Crée ton compte et configure ta boutique, tes contacts et tes conditions de livraison.'],['02','Fais-la à ton image.','Ajoute tes produits, choisis ton thème et compose tes pages de présentation.'],['03','Passe à l’action.','Publie avec une formule active, partage ta boutique et gère tes commandes.']].map(([number,title,text])=><article key={number}><span>{number}<ArrowUpRight size={25}/></span><h3>{title}</h3><p>{text}</p></article>)}</div>
  </section>
  <section className={styles.faq} data-reveal><div><p className={styles.eyebrow}>ON T’EXPLIQUE</p><h2>Bonne question.</h2><p>Les réponses avant de te lancer.</p></div><div>{questions.map(([question,answer])=><details key={question}><summary>{question}<Plus size={19}/></summary><p>{answer}</p></details>)}</div></section>
  <section className={styles.finalCta} data-reveal><span className={styles.ctaStar} aria-hidden="true">✳</span><p className={styles.eyebrow}>LA SUITE, C’EST TOI QUI L’ÉCRIS.</p><h2>Ton prochain grand truc<br/>commence ici.</h2><Link href="/inscription" className={styles.darkCta}>Créer ma boutique <ArrowUpRight size={23}/></Link><small>Découvre les offres et leurs conditions depuis ton espace.</small></section>
  <footer className={styles.footer}><Link href="/decouvrir" className={styles.logo}><span className={styles.logoMark} aria-hidden="true">t.</span>tunicom<span className={styles.logoDot}></span></Link><span>Pensé pour les idées d’ici. Et les ambitions sans limites.</span><div><Link href="/connexion/boutique">Espace marchand <ArrowUpRight size={13}/></Link><a href="#themes">Les thèmes</a><a href="#comment">Se lancer</a></div><p>Tunicom · Le commerce à ton rythme.</p></footer>
 </main>;
}
