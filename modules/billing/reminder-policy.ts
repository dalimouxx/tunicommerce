import {z} from 'zod';

const day=86_400_000;
export type SubscriptionReminderKind='DUE_7'|'DUE_1'|'EXPIRED';
/** One current phase only; no catch-up burst after downtime. Never changes access rights. */
export function subscriptionReminderKind(status:string,end:Date|null,now=new Date()):SubscriptionReminderKind|null{
 if(!['ACTIVE','TRIAL'].includes(status)||!end)return null;
 const remaining=end.getTime()-now.getTime();
 if(!Number.isFinite(remaining)||remaining>7*day||remaining<=-day)return null;
 return remaining<=0?'EXPIRED':remaining<=day?'DUE_1':'DUE_7';
}
export const subscriptionReminderPayload=z.object({workspaceId:z.uuid(),ownerId:z.uuid(),email:z.email(),
 endsAt:z.iso.datetime(),plan:z.string().min(1).max(100),kind:z.enum(['DUE_7','DUE_1','EXPIRED']),
 preferenceVersion:z.number().int().nonnegative(),at:z.iso.datetime()}).strict();
export const subscriptionReminderChange=z.object({enabled:z.boolean(),expectedVersion:z.number().int().min(0).max(2147483646)}).strict();

export function subscriptionReminderMessage(kind:SubscriptionReminderKind,end:Date,origin:string){
 const date=new Intl.DateTimeFormat('fr-TN',{dateStyle:'long',timeStyle:'short',timeZone:'Africa/Tunis',hourCycle:'h23'}).format(end);
 const subject=kind==='EXPIRED'?'Tunicom · Votre abonnement est arrivé à échéance':'Tunicom · Votre abonnement arrive à échéance';
 return {subject,text:(kind==='EXPIRED'?'Votre abonnement Tunicom est arrivé à échéance le ':'Votre abonnement Tunicom arrive à échéance le ')+date+
  '.\n\nConsultez votre abonnement et les démarches de renouvellement :\n'+origin+'/mon-abonnement'+
  '\n\nAucun prélèvement automatique n’est effectué. Si vous avez déclaré un règlement, consultez son statut sur cette page.'+
  '\nVous pouvez désactiver ces rappels dans Mon abonnement.'};
}
