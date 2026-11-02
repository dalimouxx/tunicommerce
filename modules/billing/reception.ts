import {z} from 'zod';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';

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
export async function enabledReceptionMethods(
 db:Pick<typeof prisma,'paymentReceptionMethod'>=prisma
):Promise<ReceptionPublic[]>{
 const rows=await db.paymentReceptionMethod.findMany({
  where:{enabled:true},orderBy:{code:'asc'},
  select:{code:true,recipientName:true,identifier:true,bankName:true,instructions:true}
 });
 // Do not leak incorrect/incomplete collection instructions if old records were altered outside the UI.
 return rows.filter(row=>
  receptionCode.safeParse(row.code).success&&
  receptionInput.safeParse({...row,version:0,enabled:true}).success
 ).map(row=>({
  code:receptionCode.parse(row.code),
  recipientName:row.recipientName,identifier:row.identifier,
  bankName:row.bankName,instructions:row.instructions
 }));
}

export async function assertReceptionEnabled(code:ReceptionCode,
 db:Pick<typeof prisma,'paymentReceptionMethod'>=prisma){
 const record=await db.paymentReceptionMethod.findUnique({where:{code}});
 if(!record||!receptionInput.safeParse({
  code:record.code,version:record.version,enabled:record.enabled,
  recipientName:record.recipientName,identifier:record.identifier,
  bankName:record.bankName,instructions:record.instructions
 }).success||!record.enabled)
  throw new HttpError(409,'Ce moyen de paiement n’est pas encore officiellement configuré. Consultez les instructions affichées sur Mon abonnement.');
 return record;
}
