import {z} from 'zod';
import {mediaPath} from '../media/validation';

export const themes=['classic','editorial','prestige','pop'] as const;
export type StoreTheme=(typeof themes)[number];

export const accents=['#21815F','#244A77','#893F49','#633D81','#A0511D','#293442'] as const;
export type StoreAccent=(typeof accents)[number];

/** Only our exact UUID-based asset URLs are allowed as internal images. */
function safeBrandImage(value:string){
 if(!value||mediaPath.test(value))return true;
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&!url.username&&!url.password;
 }catch{return false;}
}

export const appearanceSchema=z.object({
 theme:z.enum(themes),
 accent:z.enum(accents),
 eyebrow:z.string().trim().max(85),
 tagline:z.string().trim().max(160),
 description:z.string().trim().max(1000),
 logoUrl:z.string().trim().max(2000).refine(safeBrandImage,'Utilisez HTTPS ou une image importée dans votre boutique'),
 bannerUrl:z.string().trim().max(2000).refine(safeBrandImage,'Utilisez HTTPS ou une image importée dans votre boutique')
}).strict();

export type AppearanceInput=z.infer<typeof appearanceSchema>;
export type Presentation=Pick<AppearanceInput,'theme'|'accent'|'eyebrow'|'tagline'>;

export const defaultPresentation:Presentation={
 theme:'classic',accent:'#21815F',eyebrow:'BOUTIQUE INDÉPENDANTE · TUNISIE',
 tagline:'Livraison en Tunisie · Paiement à la livraison'
};

const persistedSchema=appearanceSchema.pick({
 theme:true,accent:true,eyebrow:true,tagline:true
});

export function readPresentation(source:unknown):Presentation{
 if(!source||typeof source!=='object')return {...defaultPresentation};
 const value=(source as Record<string,unknown>).appearance;
 const parsed=persistedSchema.safeParse(value);
 return parsed.success?parsed.data:{...defaultPresentation};
}
