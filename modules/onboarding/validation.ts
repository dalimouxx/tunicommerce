import {z} from 'zod';

const slug=z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Lien : lettres minuscules, chiffres et tirets uniquement').min(3).max(60);

export const merchantRegistration=z.object({
 name:z.string().trim().min(2).max(100),
 email:z.string().trim().toLowerCase().email().max(254),
 password:z.string().min(12,'Le mot de passe doit comporter au moins 12 caractères').max(128),
 shopName:z.string().trim().min(2).max(100),
 slug
}).strict();

export const merchantOnboardingAction=z.discriminatedUnion('action',[
 z.object({
  action:z.literal('details'),
  name:z.string().trim().min(2).max(100),
  phone:z.string().trim().max(30),
  address:z.string().trim().max(200),
  description:z.string().trim().max(1000),
  shipping:z.number().int().min(0).max(1_000_000_000)
 }).strict(),
 z.object({action:z.literal('publish')}).strict(),
 z.object({action:z.literal('unpublish')}).strict(),
 z.object({action:z.literal('slug'),slug}).strict()
]);

export type MerchantRegistration=z.infer<typeof merchantRegistration>;
export type MerchantOnboardingAction=z.infer<typeof merchantOnboardingAction>;
