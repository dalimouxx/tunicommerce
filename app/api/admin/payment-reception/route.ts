import {z} from 'zod';
import {prisma} from '../../../../modules/storage/client';
import {requireAdmin} from '../../../../modules/platform/admin';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {receptionInput} from '../../../../modules/billing/reception';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  await requireAdmin();
  const [methods,history]=await Promise.all([
   prisma.paymentReceptionMethod.findMany({orderBy:{code:'asc'}}),
   prisma.paymentReceptionAudit.findMany({
    orderBy:{createdAt:'desc'},take:20,
    select:{id:true,actorId:true,methodCode:true,oldVersion:true,nextVersion:true,changed:true,createdAt:true}
   })
  ]);
  return respond({methods,history});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  return respond({error:'Configuration des paiements indisponible'},503);
 }
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const actor=await requireAdmin();
  const input=receptionInput.parse(await readJson(req,8000));
  const saved=await prisma.$transaction(async tx=>{
   const prior=await tx.paymentReceptionMethod.findUnique({where:{code:input.code}});
   if(!prior)throw new HttpError(404,'Moyen de paiement inconnu');
   if(prior.version!==input.version)throw new HttpError(409,'Paramètres modifiés dans une autre session. Rechargez la page.');
   const keys=['enabled','recipientName','identifier','bankName','instructions'] as const;
   const changed=keys.filter(key=>input[key]!==prior[key]);
   if(changed.length===0)return prior;
   const result=await tx.paymentReceptionMethod.updateMany({
    where:{code:input.code,version:input.version},
    data:{
     enabled:input.enabled,recipientName:input.recipientName,
     identifier:input.identifier,bankName:input.bankName,
     instructions:input.instructions,updatedById:actor.userId,
     version:{increment:1}
    }
   });
   if(result.count!==1)throw new HttpError(409,'Modification concurrente. Rechargez la page.');
   const updated=await tx.paymentReceptionMethod.findUniqueOrThrow({where:{code:input.code}});
   await tx.paymentReceptionAudit.create({data:{
    actorId:actor.userId,methodCode:input.code,
    oldVersion:input.version,nextVersion:updated.version,
    // Do not repeat the account identifier or private notes in audit logs.
    changed:{fields:changed,enabled:input.enabled}
   }});
   return updated;
  });
  return respond({method:saved});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Configuration invalide'},400);
  return respond({error:'Enregistrement impossible'},503);
 }
}
