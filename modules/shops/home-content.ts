import {z} from 'zod';
import {pageSection,pageSectionLabels} from './page-content';
import {homeImageSection,homePhotoId} from './home-image';

export const homeSection=z.discriminatedUnion('type',[...pageSection.options,homeImageSection]);
export type HomeSection=z.infer<typeof homeSection>;
export const homeSectionLabels:Record<HomeSection['type'],string>={...pageSectionLabels,image:'Image et légende'};

const localizedHome=z.object({
 heroTitle:z.string().trim().max(140),
 heroDescription:z.string().trim().max(1000),
 announcement:z.string().trim().max(180),
 sections:z.array(homeSection).max(8).refine(items=>new Set(items.map(item=>item.id)).size===items.length,'Identifiants de sections dupliqués')
}).strict();
export const homeContent=z.object({
 fr:localizedHome,ar:localizedHome,showBenefits:z.boolean(),sectionsPosition:z.enum(['beforeCatalog','afterCatalog'])
}).strict().refine(value=>new TextEncoder().encode(JSON.stringify(value)).length<=40000,'Le contenu de l’accueil est trop volumineux');
export type HomeContent=z.infer<typeof homeContent>;
export function homePhotoIds(content:HomeContent){return [...new Set([...content.fr.sections,...content.ar.sections].flatMap(section=>section.type==='image'&&homePhotoId(section.imageUrl)?[homePhotoId(section.imageUrl)!]:[]))];}
export type HomeEditorRecord={draft:HomeContent;version:number;publishedAt:string|null;publishedVersion:number|null;hasUnpublishedChanges:boolean};
export const changeHomeInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('save'),version:z.number().int().nonnegative(),content:homeContent}).strict(),
 z.object({action:z.enum(['publish','unpublish','restore']),version:z.number().int().nonnegative()}).strict()
]);
export function initialHomeContent():HomeContent{
 const empty=()=>({heroTitle:'',heroDescription:'',announcement:'',sections:[]});
 return {fr:empty(),ar:empty(),showBenefits:true,sectionsPosition:'beforeCatalog'};
}
