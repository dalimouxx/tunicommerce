import Link from 'next/link';
import type {ThemeLayout} from '../modules/shops/theme-layouts';
import {formatStorefrontMoney,storefrontDictionary,storefrontLangHref,type StorefrontLang} from '../modules/shops/storefront-i18n';

type ExtraProduct={id:string;name:string;price:number;imageUrl?:string;available:boolean};
type Props={layout:ThemeLayout;products:readonly ExtraProduct[];categories:readonly string[];lang:StorefrontLang;shopPath:string;hrefFor?:(id:string)=>string};

/** Layout-specific hero content. A tile or strip is rendered only when real shop data backs it. */
export default function ThemeHeroExtras({layout,products,categories,lang,shopPath,hrefFor}:Props){
 const t=storefrontDictionary(lang);
 const productHref=hrefFor||((id:string)=>storefrontLangHref(shopPath+'/produit/'+encodeURIComponent(id),lang));
 const available=products.filter(product=>product.available);
 if(layout.hero==='bento'){
  const featured=available[0];
  return <div data-part="bento">
   {categories.length>0&&<div data-part="bento-tile" data-tile="categories">
    <small>{t.categoriesLabel}</small>
    <ul>{categories.slice(0,4).map(name=><li key={name} dir="auto">{name}</li>)}</ul>
   </div>}
   {featured&&<Link data-part="bento-tile" data-tile="featured" href={productHref(featured.id)}>
    <small>{t.bentoFeatured}</small><strong dir="auto">{featured.name}</strong><span>{formatStorefrontMoney(featured.price,lang)}</span>
   </Link>}
   <div data-part="bento-tile" data-tile="cod"><strong>{t.pillarCod}</strong><small>{t.pillarCodText}</small></div>
  </div>;
 }
 if(layout.hero==='marquee'){
  const items=available.slice(0,6);
  if(items.length===0)return null;
  const row=(hidden:boolean)=><ul aria-hidden={hidden||undefined}>{items.map(product=><li key={product.id}>
   <Link href={productHref(product.id)} tabIndex={hidden?-1:undefined}>
    {product.imageUrl&&<img src={product.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>}
    <span dir="auto">{product.name}</span><b>{formatStorefrontMoney(product.price,lang)}</b>
   </Link></li>)}</ul>;
  return <div data-part="souk-strip" aria-label={t.soukStripLabel} role="region"><div data-track>{row(false)}{row(true)}</div></div>;
 }
 return null;
}
