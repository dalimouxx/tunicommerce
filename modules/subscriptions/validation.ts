import {z} from 'zod';

const quota=z.number().int().min(0).max(1_000_000).nullable();
export const planCode=z.string().regex(/^[A-Z][A-Z0-9_]{1,23}$/,'Code en majuscules, 2 à 24 caractères');
export const moduleKeys=['callCenter','marketing','analytics','aiCopilot','customDomain','multiShop'] as const;
export const modulesSchema=z.object({
 callCenter:z.boolean(),
 marketing:z.boolean(),
 analytics:z.boolean(),
 aiCopilot:z.boolean(),
 customDomain:z.boolean(),
 multiShop:z.boolean()
}).strict();
export type PlanModules=z.infer<typeof modulesSchema>;

export const planInput=z.object({
 code:planCode,
 name:z.string().trim().min(2).max(80),
 description:z.string().trim().max(500),
 priceMillimes:z.number().int().min(0).max(100_000_000),
 durationDays:z.number().int().min(1).max(3650),
 maxProducts:quota,
 maxOrdersPerMonth:quota,
 maxPhotos:quota,
 maxShops:quota,
 maxMembers:quota,
 modules:modulesSchema,
 enabled:z.boolean()
}).strict();
export type PlanInput=z.infer<typeof planInput>;

export const overrideInput=z.object({
 workspaceId:z.string().uuid(),
 maxProducts:quota,
 maxOrdersPerMonth:quota,
 maxPhotos:quota,
 note:z.string().trim().max(500)
}).strict();
export type OverrideInput=z.infer<typeof overrideInput>;

export function limitDisplay(limit:number|null){
 return limit===null||limit===0?'Illimité':String(limit);
}

export function effectiveLimit(plan:number|null,exception:number|null|undefined){
 const value=exception??plan;
 return value===null||value===0?null:value;
}
