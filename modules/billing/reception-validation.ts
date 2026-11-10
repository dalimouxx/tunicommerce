import {z} from 'zod';

export const receptionCode=z.enum(['D17','BANK_TRANSFER','CASH']);
export type ReceptionCode=z.infer<typeof receptionCode>;

export const receptionInput=z.object({
 code:receptionCode,
 version:z.number().int().min(0),
 enabled:z.boolean(),
 recipientName:z.string().trim().max(120),
 identifier:z.string().trim().max(100),
 bankName:z.string().trim().max(100),
 instructions:z.string().trim().max(1000)
}).strict().superRefine((input,ctx)=>{
 if(!input.enabled)return;
 if(input.recipientName.length<2)
  ctx.addIssue({code:'custom',path:['recipientName'],message:'Identité du bénéficiaire requise'});
 if(input.instructions.length<12)
  ctx.addIssue({code:'custom',path:['instructions'],message:'Instructions officielles requises (12 caractères minimum)'});
 if(input.code!=='CASH'&&input.identifier.length<6)
  ctx.addIssue({code:'custom',path:['identifier'],message:'Numéro ou référence du compte requise'});
 if(input.code==='BANK_TRANSFER'&&input.bankName.length<2)
  ctx.addIssue({code:'custom',path:['bankName'],message:'Nom de la banque requis'});
});
export type ReceptionInput=z.infer<typeof receptionInput>;

export type ReceptionPublic={
 code:ReceptionCode;recipientName:string;identifier:string;bankName:string;instructions:string
};

export function receptionLabel(code:ReceptionCode){
 return code==='D17'?'D17':code==='BANK_TRANSFER'?'Virement bancaire':'Espèces';
}
