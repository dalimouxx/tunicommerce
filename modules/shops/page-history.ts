import {z} from 'zod';
import {pageContent} from './page-content';

export const PAGE_HISTORY_LIMIT=20;
export const pageRevision=z.object({
 id:z.uuid(),version:z.number().int().nonnegative().nullable(),createdAt:z.iso.datetime(),
 action:z.enum(['create','save','publish','unpublish','restoreRevision','checkpoint','publishedCheckpoint']),content:pageContent
}).strict();
export type PageRevision=z.infer<typeof pageRevision>;
export const pageHistory=z.array(pageRevision).max(PAGE_HISTORY_LIMIT);
export function readPageHistory(value:unknown):PageRevision[]{return pageHistory.parse(value??[]);}
export const pageHistoryLabels:Record<PageRevision['action'],string>={create:'Création du brouillon',save:'Brouillon enregistré',publish:'Publication',unpublish:'Retrait de publication',restoreRevision:'Version restaurée',checkpoint:'Brouillon antérieur à l’historique',publishedCheckpoint:'Publication antérieure à l’historique'};
export const pageRevisionSummary=pageRevision.omit({content:true}).extend({title:z.string(),language:z.enum(['fr','ar']),sections:z.number().int().nonnegative()});
export type PageRevisionSummary=z.infer<typeof pageRevisionSummary>;
export function summarizePageRevision({content,...revision}:PageRevision){return {...revision,title:content.title,language:content.language,sections:content.sections.length};}
export function appendPageHistory(history:PageRevision[],entry:PageRevision){return [...history,entry].slice(-PAGE_HISTORY_LIMIT);}
