import Link from 'next/link';
import type {PageContent} from '../modules/shops/page-content';
import styles from './shop-pages.module.css';
import imageStyles from './shop-home.module.css';
import {pageImageSource} from '../modules/shops/page-image';

export function ShopPageSections({content,catalog='',interactive=true,shopSlug,pageSlug,preview=true}:{content:PageContent;catalog?:string;interactive?:boolean;shopSlug?:string;pageSlug?:string;preview?:boolean}){
 return <div className={styles.sections}>{content.sections.map(section=><section key={section.id} className={section.type==='hero'?styles.hero:styles.section} dir="auto">
  <h2>{section.title}</h2>
  {section.type==='image'&&<figure className={imageStyles.imageFigure}><div className={imageStyles.imageFrame} data-image-layout={section.layout}><img src={pageImageSource(section.imageUrl,shopSlug,pageSlug,preview)} alt={section.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{objectFit:section.fit}}/></div>{section.caption&&<figcaption dir="auto">{section.caption}</figcaption>}</figure>}
  {(section.type==='hero'||section.type==='text'||section.type==='cta')&&<p className={styles.prose}>{section.text}</p>}
  {section.type==='benefits'&&<ul className={styles.benefits}>{section.items.map((item,index)=><li key={index}><span aria-hidden="true">✓</span>{item}</li>)}</ul>}
  {section.type==='faq'&&<div className={styles.questions}>{section.items.map((item,index)=><details key={index}><summary>{item.question}</summary><p className={styles.prose}>{item.answer}</p></details>)}</div>}
  {section.type==='cta'&&(interactive?<Link className={styles.primary} href={catalog}>{section.label} ↗</Link>:<span className={styles.primary}>{section.label} ↗</span>)}
 </section>)}</div>;
}

export default function ShopPageContent({content,shopName,slug,pageSlug,preview=false,storefrontPath}:{content:PageContent;shopName:string;slug:string;pageSlug?:string;preview?:boolean;storefrontPath?:string}){
 const catalog=(storefrontPath||'/vitrines/'+encodeURIComponent(slug))+'?lang='+content.language+'#catalogue';
 return <main className={styles.publicPage} lang={content.language} dir={content.language==='ar'?'rtl':'ltr'}>
  {preview&&<aside className={styles.preview}>APERÇU PRIVÉ · Brouillon enregistré. Les modifications non enregistrées ne sont pas affichées.</aside>}
  <header className={styles.publicHeader}><strong>{shopName}</strong><Link href={catalog}>{content.language==='ar'?'العودة إلى المتجر':'Retour à la boutique'} ↗</Link></header>
  <div className={styles.pageTitle}><span>{shopName}</span><h1 dir="auto">{content.title}</h1>{content.description&&<p dir="auto">{content.description}</p>}</div>
  <ShopPageSections content={content} catalog={catalog} shopSlug={slug} pageSlug={pageSlug} preview={preview}/>
  <footer className={styles.publicFooter}>{shopName} · <Link href={catalog}>{content.language==='ar'?'المنتجات':'Découvrir les produits'}</Link></footer>
 </main>;
}
