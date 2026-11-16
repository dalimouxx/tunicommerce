import {z} from 'zod';
import {reservedStorefrontSlugs} from './domains-validation';

export const organizationInput=z.object({
 name:z.string().trim().min(2).max(100),
}).strict();

export const newShopInput=z.object({
 organizationId:z.string().uuid(),
 name:z.string().trim().min(2).max(100),
 slug:z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60).refine(value=>!reservedStorefrontSlugs.has(value),'Ce nom de lien est réservé à la plateforme.'),
}).strict();

export const shopIdInput=z.string().uuid();
