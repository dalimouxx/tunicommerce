import {z} from 'zod';
import type {State} from '../commerce/types';
import {writeIsolatedCommerce} from './aggregate-quotas';

export const storefrontThemeCodes=['OASIS','SABLE','MINUIT'] as const;
export type StorefrontThemeCode=(typeof storefrontThemeCodes)[number];
export const storefrontThemeInput=z.object({
 action:z.literal('saveStorefrontTheme'),requestId:z.string().uuid(),
 payload:z.object({theme:z.enum(storefrontThemeCodes)}).strict()
}).strict();
const palettes:Record<StorefrontThemeCode,{name:string;background:string;foreground:string;accent:string;surface:string;muted:string}>={
 OASIS:{name:'Oasis',background:'#f2f8f5',foreground:'#153d36',accent:'#096a58',surface:'#ffffff',muted:'#527269'},
 SABLE:{name:'Sable',background:'#faf5ed',foreground:'#433126',accent:'#9e5a2b',surface:'#ffffff',muted:'#785d4e'},
 MINUIT:{name:'Minuit',background:'#111d2b',foreground:'#e9f2fb',accent:'#75bbd9',surface:'#1e3043',muted:'#b6cada'}
};
export function storefrontPalette(value:unknown){
 const code:StorefrontThemeCode=storefrontThemeCodes.includes(value as StorefrontThemeCode)?value as StorefrontThemeCode:'OASIS';
 return {code,...palettes[code]};
}
export async function updateStorefrontTheme(ownerId:string,shopId:string,input:z.infer<typeof storefrontThemeInput>){
 return writeIsolatedCommerce(ownerId,shopId,input,()=>{});
}
/** Explicitly whitelist every color, never use arbitrary CSS from tenant data. */
export function storefrontThemeSummary(state:State){return storefrontPalette(state.shop.theme);}
