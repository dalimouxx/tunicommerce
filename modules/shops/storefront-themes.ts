import {z} from 'zod';
import type {State} from '../commerce/types';

/** Presets only: tenants can select a theme, never submit executable CSS. */
export const storefrontThemeCodes=['OASIS','SABLE','MINUIT','NOVA','ATELIER','PRESTIGE','POP','ECLAT','URBAN','ZEN','PULSE','SORBET','CHROME','GROOVE','MEDINA','SAHARA','BENTO','SOUK','AURORA','MAGAZINE'] as const;
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
 GROOVE:{name:'Groove',description:'Lavande expressive · lifestyle et collections créatives',background:'#eee8ff',foreground:'#302251',accent:'#5e35b6',accentText:'#ffffff',surface:'#faf7ff',muted:'#70618d'},
 MEDINA:{name:'Médina',description:'Zellige et arches · artisanat, déco et cadeaux',background:'#f7f1e6',foreground:'#1d2a44',accent:'#1f4fa0',accentText:'#ffffff',surface:'#fffaf1',muted:'#5b6377'},
 SAHARA:{name:'Sahara',description:'Dunes et lumière dorée · mode, parfums et bien-être',background:'#f4e9da',foreground:'#3a2617',accent:'#9a4a1c',accentText:'#ffffff',surface:'#fbf4ea',muted:'#7a5d47'},
 BENTO:{name:'Bento',description:'Mosaïque nette · tech et accessoires',background:'#f5f5f7',foreground:'#111114',accent:'#0a66d9',accentText:'#ffffff',surface:'#ffffff',muted:'#5d5d66'},
 SOUK:{name:'Souk Flash',description:'Promos franches · ventes rapides et paiement à la livraison',background:'#fff8e1',foreground:'#1b1b1b',accent:'#d7261e',accentText:'#ffffff',surface:'#ffffff',muted:'#5a5148'},
 AURORA:{name:'Aurora',description:'Lumières et verre dépoli · beauté et jeunes marques',background:'#0f0d1d',foreground:'#f4f1ff',accent:'#e8a6ff',accentText:'#1b0f24',surface:'#1b1830',muted:'#c9c2e3'},
 MAGAZINE:{name:'Magazine',description:'Grande image, titres géants · mode et créateurs',background:'#fbfaf7',foreground:'#141414',accent:'#141414',accentText:'#ffffff',surface:'#ffffff',muted:'#5f5f5f'}
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
 FASHION:['PULSE','GROOVE','SOUK','MAGAZINE','SAHARA','ATELIER','URBAN','POP','PRESTIGE'],
 BEAUTY:['SORBET','AURORA','SAHARA','GROOVE','ECLAT','POP','OASIS','PRESTIGE'],
 TECH:['CHROME','BENTO','AURORA','PULSE','NOVA','MINUIT','URBAN'],
 HOME:['MEDINA','SABLE','ZEN','ATELIER','OASIS','GROOVE'],
 LUXURY:['PRESTIGE','SAHARA','MAGAZINE','ECLAT','MINUIT'],
 WELLNESS:['ZEN','SAHARA','MEDINA','OASIS','SABLE','ECLAT']
};
/** Every preset now carries the shared motion layer, so every one offers the pause control. */
export function animatedStorefrontTheme(code:unknown){return storefrontThemeCodes.includes(code as StorefrontThemeCode);}
/** Only predetermined theme codes, no tenant-submitted CSS or remote assets. */
export function storefrontThemesForSector(sector:unknown):readonly StorefrontThemeCode[]{
 if(sector==='ALL')return storefrontThemeCodes;
 if(typeof sector!=='string'||!Object.hasOwn(sectorPresets,sector))
  return storefrontThemeCodes;
 return sectorPresets[sector as Exclude<StorefrontSector,'ALL'>];
}
