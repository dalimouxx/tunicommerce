import {z} from 'zod';
import type {State} from '../commerce/types';

/** Presets only: tenants can select a theme, never submit executable CSS. */
export const storefrontThemeCodes=['OASIS','SABLE','MINUIT','NOVA','ATELIER','PRESTIGE','POP','ECLAT','URBAN','ZEN','PULSE','SORBET','CHROME','GROOVE'] as const;
export type StorefrontThemeCode=(typeof storefrontThemeCodes)[number];
export const storefrontThemeInput=z.object({
 action:z.literal('saveStorefrontTheme'),requestId:z.string().uuid(),
 payload:z.object({theme:z.enum(storefrontThemeCodes)}).strict()
}).strict();
export type StorefrontThemeInput=z.infer<typeof storefrontThemeInput>;
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
  foreground:'#382338',accent:'#a42d67',accentText:'#ffffff',surface:'#ffffff',muted:'#755367'},
 ECLAT:{name:'Éclat',description:'Beauté et cosmétiques · rose éditorial lumineux',background:'#fff7f4',
  foreground:'#392b35',accent:'#982746',accentText:'#ffffff',surface:'#ffffff',muted:'#765c69'},
 URBAN:{name:'Urban',description:'Streetwear et sport · contraste graphique urbain',background:'#edf1f3',
  foreground:'#182b36',accent:'#204153',accentText:'#ffffff',surface:'#ffffff',muted:'#566b75'},
 ZEN:{name:'Zen',description:'Bien-être et décoration · minimalisme naturel',background:'#f3f6f0',
  foreground:'#25392c',accent:'#35694b',accentText:'#ffffff',surface:'#ffffff',muted:'#5f7566'},
 PULSE:{name:'Pulse',description:'Énergie néon · streetwear, sport et drops',background:'#121610',foreground:'#f7faef',accent:'#c9ff4a',accentText:'#141812',surface:'#20271d',muted:'#bec8b7'},
 SORBET:{name:'Sorbet',description:'Pêche et cerise · beauté, accessoires et créateurs',background:'#fff2e8',foreground:'#3c2127',accent:'#b52e45',accentText:'#ffffff',surface:'#fffaf5',muted:'#80616a'},
 CHROME:{name:'Chrome',description:'Bleu glacé · tech, audio et objets connectés',background:'#eaf2f9',foreground:'#142b42',accent:'#1749c5',accentText:'#ffffff',surface:'#ffffff',muted:'#52697f'},
 GROOVE:{name:'Groove',description:'Lavande expressive · lifestyle et collections créatives',background:'#eee8ff',foreground:'#302251',accent:'#5e35b6',accentText:'#ffffff',surface:'#faf7ff',muted:'#70618d'}
};
export function storefrontPalette(value:unknown){
 const code:StorefrontThemeCode=storefrontThemeCodes.includes(value as StorefrontThemeCode)?
  value as StorefrontThemeCode:'OASIS';
 return {code,...palettes[code]};
}
export function storefrontThemeSummary(state:State){return storefrontPalette(state.shop.theme);}

/** An owner may try a preset without saving it. Untrusted values never become CSS. */
export function previewStorefrontTheme(active:unknown,requested:unknown){
 const saved=storefrontPalette(active);
 if(typeof requested!=='string'||!storefrontThemeCodes.includes(requested as StorefrontThemeCode))
  return {theme:saved,temporary:false};
 const next=storefrontPalette(requested);
 return {theme:next,temporary:next.code!==saved.code};
}

/** Editorial suggestions are only a gallery filter, never a restriction on plans. */
export const storefrontSectors=[
 {id:'ALL',label:'Tous les univers'},
 {id:'FASHION',label:'Mode et accessoires'},
 {id:'BEAUTY',label:'Beauté et cadeaux'},
 {id:'TECH',label:'Tech et électronique'},
 {id:'HOME',label:'Maison et artisanat'},
 {id:'LUXURY',label:'Bijoux et luxe'},
 {id:'WELLNESS',label:'Bien-être et naturel'}
] as const;
export type StorefrontSector=(typeof storefrontSectors)[number]['id'];
const sectorPresets:Record<Exclude<StorefrontSector,'ALL'>,readonly StorefrontThemeCode[]>={
 FASHION:['PULSE','GROOVE','ATELIER','URBAN','POP','PRESTIGE'],
 BEAUTY:['SORBET','GROOVE','ECLAT','POP','OASIS','PRESTIGE'],
 TECH:['CHROME','PULSE','NOVA','MINUIT','URBAN'],
 HOME:['SABLE','ZEN','ATELIER','OASIS','GROOVE'],
 LUXURY:['PRESTIGE','ECLAT','MINUIT'],
 WELLNESS:['ZEN','OASIS','SABLE','ECLAT']
};
export function animatedStorefrontTheme(code:unknown){return ['PULSE','SORBET','CHROME','GROOVE'].includes(String(code));}
/** Only predetermined theme codes, no tenant-submitted CSS or remote assets. */
export function storefrontThemesForSector(sector:unknown):readonly StorefrontThemeCode[]{
 if(sector==='ALL')return storefrontThemeCodes;
 if(typeof sector!=='string'||!Object.hasOwn(sectorPresets,sector))
  return storefrontThemeCodes;
 return sectorPresets[sector as Exclude<StorefrontSector,'ALL'>];
}
