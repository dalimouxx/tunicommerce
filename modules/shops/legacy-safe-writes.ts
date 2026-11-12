import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {normalizeState} from '../commerce/normalize';
import {applyAction} from '../commerce/service';
import {readWorkspace} from '../storage/repository';
import {loadWorkspaceQuotas} from '../subscriptions/quotas';
import type {State} from '../commerce/types';
import {assertMerchantAggregateQuotas} from './aggregate-quotas';
import {enqueueOrderMail} from '../messaging/order-mail-service';
import {syncCatalog} from './catalog-index-service';
import {enqueueBusinessWebhooks} from '../messaging/webhook-outbox';

type LegacyInput={action:string;payload?:unknown;requestId:string};

/**
 * Legacy and independent shops MUST serialize on the same owner advisory lock.
 * Both paths enforce the same aggregate plan quotas from one committed snapshot.
 * Only legacy Workspace is mutated here; isolated shop JSON stays unchanged.
 */
export async function mutateLegacyCommerce(ownerId:string,input:LegacyInput){
 // Preserve legacy lazy initialization. Do this outside a transaction.
 await readWorkspace(ownerId);
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${ownerId}))`;
  const workspace=await tx.workspace.findUnique({
   where:{ownerId},select:{id:true,plan:true,data:true,version:true,catalogVersion:true}
  });
  if(!workspace)throw new HttpError(404,'Espace commercial introuvable');
  const before=normalizeState(workspace.data as unknown as State);
  if(before.requests.includes(input.requestId))
   return {state:before,version:workspace.version,alreadyApplied:true};
  let next:State;
  try{next=applyAction(before,input.action,input.payload);}
  catch(error){
   if(error instanceof z.ZodError)throw new HttpError(400,error.issues[0]?.message||'Données invalides');
   throw new HttpError(400,error instanceof Error?error.message:'Opération invalide');
  }
  const [quotas,otherRows]=await Promise.all([
   loadWorkspaceQuotas({id:workspace.id,plan:workspace.plan},tx),
   tx.shopCommerce.findMany({where:{shop:{organization:{ownerId}}},select:{data:true}})
  ]);
  assertMerchantAggregateQuotas(
   otherRows.map(row=>normalizeState(row.data as unknown as State)),
   before,next,quotas
  );
  next.requests=[...before.requests.slice(-999),input.requestId];
  const update=await tx.workspace.updateMany({
   where:{ownerId,version:workspace.version},
   data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}
  });
  if(update.count!==1)throw new HttpError(409,'Modification concurrente : réessayez');
  await enqueueOrderMail(tx,{workspaceId:workspace.id,ownerId},before,next,workspace.version+1);
  await syncCatalog(tx,{workspaceId:workspace.id,ownerId},before,next,workspace.catalogVersion);
  await enqueueBusinessWebhooks(tx,{workspaceId:workspace.id,ownerId},before,next,workspace.version+1);
  return {state:next,version:workspace.version+1,alreadyApplied:false};
 },{timeout:15000});
}
