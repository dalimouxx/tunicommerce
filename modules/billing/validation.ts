import {z} from 'zod';

export const paymentMethod=z.enum(['D17','BANK_TRANSFER','CASH']);
export const subscriptionRequestInput=z.object({
 requestId:z.string().uuid(),
 planCode:z.string().regex(/^[A-Z][A-Z0-9_]{1,23}$/),
 method:paymentMethod,
 transferReference:z.string().trim().max(120).default(''),
 merchantNote:z.string().trim().max(500).default('')
}).strict().superRefine((value,ctx)=>{
 if(value.method!=='CASH'&&value.transferReference.length<6)
  ctx.addIssue({code:'custom',path:['transferReference'],message:'Saisissez la référence de transfert (au moins 6 caractères)'});
});
export type SubscriptionRequestInput=z.infer<typeof subscriptionRequestInput>;

export const subscriptionDecisionInput=z.object({
 id:z.string().uuid(),
 action:z.enum(['approve','reject']),
 receivedConfirmed:z.boolean().optional(),
 adminNote:z.string().trim().max(500).default('')
}).strict().superRefine((input,ctx)=>{
 if(input.action==='approve'&&input.receivedConfirmed!==true)
  ctx.addIssue({code:'custom',path:['receivedConfirmed'],message:'Confirmez la vérification de la réception des fonds'});
 if(input.action==='approve'&&input.adminNote.length<5)
  ctx.addIssue({code:'custom',path:['adminNote'],message:'Précisez la vérification du règlement (au moins 5 caractères)'});
 if(input.action==='reject'&&input.adminNote.length<5)
  ctx.addIssue({code:'custom',path:['adminNote'],message:'Motif du refus requis (au moins 5 caractères)'});
});
export type SubscriptionDecisionInput=z.infer<typeof subscriptionDecisionInput>;

export function paymentMethodLabel(method:string){
 if(method==='D17')return 'D17';
 if(method==='BANK_TRANSFER')return 'Virement bancaire';
 if(method==='CASH')return 'Espèces';
 return 'Inconnu';
}
export function paymentStatusLabel(status:string){
 if(status==='PENDING')return 'À vérifier';
 if(status==='APPROVED')return 'Validé';
 if(status==='REJECTED')return 'Refusé';
 return status;
}
export function toTnd(amountMillimes:number){
 return new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3})
  .format(amountMillimes/1000)+' TND';
}
