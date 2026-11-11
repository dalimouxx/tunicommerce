import {z} from 'zod';
import {homeContent} from './home-content';

export const HOME_HISTORY_LIMIT=20;
export const homeRevision=z.object({
 id:z.uuid(),version:z.number().int().nonnegative(),createdAt:z.iso.datetime(),
 action:z.enum(['save','publish','restore','restoreRevision','unpublish','checkpoint','publishedCheckpoint']),content:homeContent
}).strict();
export type HomeRevision=z.infer<typeof homeRevision>;
export const homeHistory=z.array(homeRevision).max(HOME_HISTORY_LIMIT);
export const homeHistoryLabels:Record<HomeRevision['action'],string>={save:'Brouillon enregistré',publish:'Publication',restore:'Copie de la version publiée',restoreRevision:'Version restaurée',unpublish:'Retour au thème',checkpoint:'Brouillon antérieur à l’historique',publishedCheckpoint:'Publication antérieure à l’historique'};
export function readHomeHistory(value:unknown):HomeRevision[]{return homeHistory.parse(value??[]);}
export function summarizeHomeRevision({content,...revision}:HomeRevision){return {...revision,title:content.fr.heroTitle||content.ar.heroTitle||'Accueil du thème',sections:content.fr.sections.length+content.ar.sections.length};}
export const homeRevisionSummary=homeRevision.omit({content:true}).extend({title:z.string(),sections:z.number().int().nonnegative()});
export type HomeRevisionSummary=z.infer<typeof homeRevisionSummary>;

/** Caller supplies fresh UUIDs; retained snapshots are never mutated. */
export function appendHomeHistory(history:HomeRevision[],entry:HomeRevision){return [...history,entry].slice(-HOME_HISTORY_LIMIT);}
