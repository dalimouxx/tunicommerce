import {z} from 'zod';

export const staffRole=z.enum(['ADMIN','MANAGER','CALL_CENTER','STOCK','DELIVERY_MANAGER','ACCOUNTANT','VIEWER']);
export type StaffRole=z.infer<typeof staffRole>;
export const inviteInput=z.object({
 email:z.string().trim().toLowerCase().email().max(254),
 role:staffRole
}).strict();
export const memberChangeInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('setRole'),role:staffRole}).strict(),
 z.object({action:z.literal('setActive'),active:z.boolean()}).strict()
]);
export const uuidParam=z.string().uuid();
