import PromoCountdown from './promo-countdown';
import {formatStorefrontMoney,type StorefrontLang} from '../modules/shops/storefront-i18n';

type PromotionView={regularPrice:number;endsAt:string;percent:number};
const endDate=(iso:string,lang:StorefrontLang)=>new Intl.DateTimeFormat(lang==='ar'?'ar-TN':'fr-FR',{day:'numeric',month:'short',timeZone:'Africa/Tunis'}).format(new Date(iso));

/** Price block: a struck-through regular price only while a real dated promotion is active. */
export default function PromoPrice({price,promotion,lang,className}:{price:number;promotion:PromotionView|null|undefined;lang:StorefrontLang;className?:string}){
 if(!promotion)return <span className={className}>{formatStorefrontMoney(price,lang)}</span>;
 return <span className={className} data-part="promo">
  <del data-part="promo-regular" aria-label={(lang==='ar'?'السعر العادي ':'Prix normal ')+formatStorefrontMoney(promotion.regularPrice,lang)}>{formatStorefrontMoney(promotion.regularPrice,lang)}</del>{' '}
  <b data-part="promo-price">{formatStorefrontMoney(price,lang)}</b>{' '}
  <span data-part="promo-badge">−{promotion.percent} %</span>{' '}
  <small data-part="promo-ends">{lang==='ar'?'حتى '+endDate(promotion.endsAt,lang):'Jusqu’au '+endDate(promotion.endsAt,lang)}</small>
  <PromoCountdown endsAt={promotion.endsAt} lang={lang}/>
 </span>;
}
