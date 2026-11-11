import Link from 'next/link';
import type {PageContent} from '../modules/shops/page-content';
import styles from './shop-pages.module.css';

export function ShopPageSections({content,catalog='',interactive=true}:{content:PageContent;catalog?:string;interactive?:boolean}){
 return <div className={styles.sections}>{content.sections.map(section=><section key={section.id} className={section.type==='hero'?styles.hero:styles.section} dir="auto">
  <h2>{section.title}</h2>
  {(section.type==='hero'||section.type==='text'||section.type==='cta')&&<p className={styles.prose}>{section.text}</p>}
  {section.type==='benefits'&&<ul className={styles.benefits}>{section.items.map((item,index)=><li key={index}><span aria-hidden="true">✓</span>{item}</li>)}</ul>}
  {section.type==='faq'&&<div className={styles.questions}>{section.items.map((item,index)=><details key={index}><summary>{item.question}</summary><p className={styles.prose}>{item.answer}</p></details>)}</div>}
  {section.type==='cta'&&(interactive?<Link className={styles.primary} href={catalog}>{section.label} ↗</Link>:<span className={styles.primary}>{section.label} ↗</span>)}
 </section>)}</div>;
}

export default function ShopPageContent({content,shopName,slug,preview=false}:{content:PageContent;shopName:string;slug:string;preview?:boolean}){
 const catalog='/vitrines/'+encodeURIComponent(slug)+'?lang='+content.language+'#catalogue';
 return <main className={styles.publicPage} lang={content.language} dir={content.language==='ar'?'rtl':'ltr'}>
  {preview&&<aside className={styles.preview}>APERÇU PRIVÉ · Brouillon enregistré. Les modifications non enregistrées ne sont pas affichées.</aside>}
  <header className={styles.publicHeader}><strong>{shopName}</strong><Link href={catalog}>{content.language==='ar'?'العودة إلى المتجر':'Retour à la boutique'} ↗</Link></header>
  <div className={styles.pageTitle}><span>{shopName}</span><h1 dir="auto">{content.title}</h1>{content.description&&<p dir="auto">{content.description}</p>}</div>
  <ShopPageSections content={content} catalog={catalog}/>
  <footer className={styles.publicFooter}>{shopName} · <Link href={catalog}>{content.language==='ar'?'المنتجات':'Découvrir les produits'}</Link></footer>
 </main>;
}
