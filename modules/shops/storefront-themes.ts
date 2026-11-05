import {z} from 'zod';
import type {State} from '../commerce/types';
import {writeIsolatedCommerce} from './aggregate-quotas';

/** Presets only: tenants can select a theme, never submit executable CSS. */
export const storefrontThemeCodes=['OASIS','SABLE','MINUIT','NOVA','ATELIER','PRESTIGE','POP'] as const;
export type StorefrontThemeCode=(typeof storefrontThemeCodes)[number];
export const storefrontThemeInput=z.object({
 action:z.literal('saveStorefrontTheme'),requestId:z.string().uuid(),
 payload:z.object({theme:z.enum(storefrontThemeCodes)}).strict()
}).strict();
type Palette={
 name:string;description:string;background:string;foreground:string;
 accent:string;accentText:string;surface:string;muted:string;
};
const palettes:Record<StorefrontThemeCode,Palette>={
 OASIS:{name:'Oasis',description:'Naturel et épuré · toutes catégories',background:'#f2f8f5',
  foreground:'#153d36',accent:'#096a58',accentText:'#ffffff',surface:'#ffffff',muted:'#527269'},
 SABLE:{name:'Sable',description:'Chaleureux · artisanat et maison',background:'#faf5ed',
  foreground:'#433126',accent:'#915025',accentText:'#ffffff',surface:'#fffefa',muted:'#785d4e'},
 MINUIT:{name:'Minuit',description:'Sombre sophistiqué · tech et lifestyle',background:'#111d2b',
  foreground:'#edf5fc',accent:'#97d5ec',accentText:'#142634',surface:'#1e3043',muted:'#cadde9'},
 NOVA:{name:'Nova',description:'Bleu premium · électronique et produits innovants',background:'#f4f6ff',
  foreground:'#152542',accent:'#2454c6',accentText:'#ffffff',surface:'#ffffff',muted:'#506484'},
 ATELIER:{name:'Atelier',description:'Éditorial · mode et objets de création',background:'#f6f2ea',
  foreground:'#392e26',accent:'#6b4530',accentText:'#ffffff',surface:'#fffdf8',muted:'#6f6258'},
 PRESTIGE:{name:'Prestige',description:'Luxe discret · bijoux et accessoires',background:'#161a20',
  foreground:'#f8f1e6',accent:'#d9af6a',accentText:'#23190f',surface:'#242b32',muted:'#cfc4b6'},
 POP:{name:'Pop',description:'Énergique et moderne · beauté et cadeaux',background:'#fff2f5',
  foreground:'#382338',accent:'#a42d67',accentText:'#ffffff',surface:'#ffffff',muted:'#755367'}
};
export function storefrontPalette(value:unknown){
 const code:StorefrontThemeCode=storefrontThemeCodes.includes(value as StorefrontThemeCode)?
  value as StorefrontThemeCode:'OASIS';
 return {code,...palettes[code]};
}
export async function updateStorefrontTheme(ownerId:string,shopId:string,input:z.infer<typeof storefrontThemeInput>){
 return writeIsolatedCommerce(ownerId,shopId,input,()=>{});
}
export function storefrontThemeSummary(state:State){return storefrontPalette(state.shop.theme);}
