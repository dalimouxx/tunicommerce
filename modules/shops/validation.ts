import {z} from 'zod';

export const organizationInput=z.object({
 name:z.string().trim().min(2).max(100),
}).strict();

export const newShopInput=z.object({
 organizationId:z.string().uuid(),
 name:z.string().trim().min(2).max(100),
 slug:z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60),
}).strict();

export const shopIdInput=z.string().uuid();
