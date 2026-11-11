import type {HomeContent} from '../modules/shops/home-content';
import styles from './shop-home.module.css';

export default function ShopHomeSections({content,lang,preview=false}:{content:HomeContent;lang:'fr'|'ar';preview?:boolean}){
 return <div className={styles.sections} lang={lang} dir={lang==='ar'?'rtl':'ltr'}>{content[lang].sections.map(section=><section key={section.id} className={styles.section} data-section-type={section.type}>
  <h2 dir="auto">{section.title}</h2>
  {(section.type==='hero'||section.type==='text'||section.type==='cta')&&<p className={styles.prose} dir="auto">{section.text}</p>}
  {section.type==='benefits'&&<ul className={styles.benefits}>{section.items.map((item,index)=><li key={index} dir="auto"><span aria-hidden="true">✦</span> {item}</li>)}</ul>}
  {section.type==='faq'&&<div className={styles.faq}>{section.items.map((item,index)=><details key={index}><summary dir="auto">{item.question}</summary><p className={styles.prose} dir="auto">{item.answer}</p></details>)}</div>}
  {section.type==='cta'&&(preview?<span className={styles.cta}>{section.label} ↗</span>:<a className={styles.cta} href="#catalogue">{section.label} ↗</a>)}
 </section>)}</div>;
}
