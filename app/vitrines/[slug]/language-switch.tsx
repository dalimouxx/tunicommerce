'use client';
import {useEffect} from 'react';
import {STOREFRONT_LANG_COOKIE,isStorefrontLang,type StorefrontLang} from '../../../modules/shops/storefront-i18n';
import styles from './storefront-premium.module.css';

/**
 * Plain link to the same page in the other language (works without JavaScript).
 * When the URL carries ?lang=, the choice is remembered for the other storefront pages.
 */
export default function LanguageSwitch({lang,href,label,ariaLabel}:{lang:StorefrontLang;href:string;label:string;ariaLabel:string}){
 useEffect(()=>{
  try{
   const requested=new URLSearchParams(window.location.search).get('lang');
   if(isStorefrontLang(requested))
    document.cookie=STOREFRONT_LANG_COOKIE+'='+requested+'; Path=/vitrines; Max-Age=31536000; SameSite=Lax';
  }catch{ /* cookies disabled: the ?lang= link still works page by page */ }
 },[lang]);
 return <a className={styles.langSwitch} href={href} hrefLang={lang==='ar'?'fr':'ar'}
  lang={lang==='ar'?'fr':'ar'} aria-label={ariaLabel}>{label}</a>;
}
