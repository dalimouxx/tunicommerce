import {z} from 'zod';

const short=z.string().trim().min(1).max(140);
const paragraph=z.string().trim().min(1).max(2500);
const id=z.uuid();
export const pageSection=z.discriminatedUnion('type',[
 z.object({id,type:z.literal('hero'),title:short,text:paragraph}).strict(),
 z.object({id,type:z.literal('text'),title:short,text:paragraph}).strict(),
 z.object({id,type:z.literal('benefits'),title:short,items:z.array(short).min(1).max(6)}).strict(),
 z.object({id,type:z.literal('faq'),title:short,items:z.array(z.object({question:short,answer:paragraph}).strict()).min(1).max(8)}).strict(),
 z.object({id,type:z.literal('cta'),title:short,text:paragraph,label:z.string().trim().min(1).max(60)}).strict()
]);
export const pageContent=z.object({title:short,description:z.string().trim().max(160),language:z.enum(['fr','ar']),
 sections:z.array(pageSection).min(1).max(12).refine(items=>new Set(items.map(item=>item.id)).size===items.length,'Identifiants de sections dupliqués')
}).strict().refine(value=>BufferSafeSize(value)<=24000,'La page est trop volumineuse');
// Browser and server share this validator without importing Node or database modules.
function BufferSafeSize(value:unknown){return new TextEncoder().encode(JSON.stringify(value)).length;}
export const createPageInput=z.object({slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60),content:pageContent}).strict();
export const changePageInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('save'),version:z.number().int().nonnegative(),content:pageContent}).strict(),
 z.object({action:z.enum(['publish','unpublish']),version:z.number().int().nonnegative()}).strict()
]);
export const deletePageInput=z.object({version:z.number().int().nonnegative()}).strict();
export type PageContent=z.infer<typeof pageContent>;
export type PageSection=z.infer<typeof pageSection>;
export type PageEditorRecord={id:string;slug:string;draft:PageContent;version:number;publishedAt:string|null};
export const pageSectionLabels:Record<PageSection['type'],string>={hero:'En-tête',text:'Texte',benefits:'Points forts',faq:'Questions fréquentes',cta:'Appel à l’action'};
export function initialPageContent(title='Notre boutique'):PageContent{
 return {title,description:'',language:'fr',sections:[{id:crypto.randomUUID(),type:'hero',title,text:'Présentez votre boutique et ce qui la rend unique.'}]};
}
