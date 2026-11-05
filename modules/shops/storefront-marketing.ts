import {z} from 'zod';
import type {State} from '../commerce/types';
import {normalizeTunisianPhone} from './product-cod-form';

/**
 * Advertising pixels and WhatsApp contact for one isolated shop.
 * Only identifiers are stored: no access token, so nothing secret reaches the storefront.
 */
export type StorefrontMarketing={metaPixelId:string;tiktokPixelId:string;whatsapp:string;whatsappMessage:string;language:'fr'|'ar'};

export const emptyMarketing:StorefrontMarketing={metaPixelId:'',tiktokPixelId:'',whatsapp:'',whatsappMessage:'',language:'fr'};

const metaPixelId=z.string().trim().regex(/^(|[0-9]{10,20})$/,'Identifiant Pixel Meta invalide : 10 à 20 chiffres');
const tiktokPixelId=z.string().trim().toUpperCase().regex(/^(|[A-Z0-9]{15,30})$/,'Identifiant Pixel TikTok invalide : 15 à 30 lettres ou chiffres');
const whatsapp=z.string().trim().max(30).transform(value=>value?normalizeTunisianPhone(value):'')
 .refine(value=>value===''||/^[2459][0-9]{7}$/.test(value),'Numéro WhatsApp tunisien invalide (8 chiffres)');

export const marketingSettings=z.object({
 metaPixelId,tiktokPixelId,whatsapp,
 whatsappMessage:z.string().trim().max(300,'Message WhatsApp trop long (300 caractères maximum)'),
 /** Default language of the public storefront; buyers can still switch. */
 language:z.enum(['fr','ar']).default('fr')
}).strict();

export const marketingMutation=z.object({
 action:z.literal('marketing'),requestId:z.string().uuid(),payload:marketingSettings
}).strict();

export function storefrontMarketing(state:State):StorefrontMarketing{
 const value=state.shop.marketing;
 return {
  metaPixelId:value?.metaPixelId||'',tiktokPixelId:value?.tiktokPixelId||'',
  whatsapp:value?.whatsapp||'',whatsappMessage:value?.whatsappMessage||'',
  language:value?.language==='ar'?'ar':'fr'
 };
}

/** wa.me link with an optional pre-filled message; empty when WhatsApp is not configured. */
export function whatsappLink(number:string,message?:string):string{
 if(!/^[2459][0-9]{7}$/.test(number))return '';
 const text=message?.trim();
 return 'https://wa.me/216'+number+(text?'?text='+encodeURIComponent(text):'');
}

export function productWhatsappMessage(marketing:StorefrontMarketing,productName:string,pageUrl?:string,defaultIntro='Bonjour, je suis intéressé(e) par'){
 const intro=marketing.whatsappMessage||defaultIntro;
 return (intro+' : '+productName+(pageUrl?'\n'+pageUrl:'')).slice(0,600);
}

export function orderWhatsappMessage(reference:string,totalMillimes?:number){
 const total=typeof totalMillimes==='number'?' ('+(totalMillimes/1000).toFixed(3)+' TND)':'';
 return 'Bonjour, je confirme ma commande '+reference+total+'.';
}
