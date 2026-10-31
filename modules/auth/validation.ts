import {z} from 'zod';
import {HttpError,respond} from './http';
export const credentials=z.object({email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(1).max(128)});
export const ownerInput=credentials.extend({name:z.string().trim().min(2).max(100),password:z.string().min(12,'Utilisez au moins 12 caractères').max(128),token:z.string().min(32).max(256)});
export function authError(e:unknown){if(e instanceof HttpError)return respond({error:e.message},e.status);if(e instanceof z.ZodError)return respond({error:e.issues[0].message},400);return respond({error:'Service temporairement indisponible'},503);}
