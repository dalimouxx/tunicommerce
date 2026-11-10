import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {receptionCode,receptionInput,type ReceptionCode,type ReceptionPublic} from './reception-validation';
export {receptionCode,receptionInput,receptionLabel,type ReceptionCode,type ReceptionInput,type ReceptionPublic} from './reception-validation';
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
