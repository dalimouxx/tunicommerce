import {z} from 'zod';
import {prisma} from '../../../../modules/storage/client';
import {requireAdmin} from '../../../../modules/platform/admin';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {independentBillingUpdate,assertIndependentBillingChange} from '../../../../modules/platform/independent-billing-control';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  const admin=await requireAdmin();
  const input=independentBillingUpdate.parse(await readJson(request,8000));
  const result=await prisma.$transaction(async tx=>{
   const shop=await tx.shop.findUnique({where:{id:input.shopId},
    select:{legacyWorkspaceId:true,organization:{select:{ownerId:true}}}});
   if(!shop||shop.legacyWorkspaceId!==null)throw new HttpError(404,'Boutique indépendante introuvable.');
   const ownerId=shop.organization.ownerId;
   // Serialize with approved payment decisions; a workspace is the account-wide billing boundary.
   const workspace=await tx.workspace.findUnique({where:{ownerId},
    select:{id:true,plan:true,subscriptionStatus:true,subscriptionEndsAt:true}});
   if(!workspace)throw new HttpError(404,'Compte de facturation introuvable.');
   await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspace.id} FOR UPDATE`;
   const current=await tx.workspace.findUniqueOrThrow({where:{id:workspace.id},
    select:{plan:true,subscriptionStatus:true,subscriptionEndsAt:true}});
   const selected=await tx.subscriptionPlan.findUnique({where:{code:input.plan},select:{enabled:true}});
   const update=assertIndependentBillingChange(input,current,selected?.enabled===true);
   await tx.workspace.update({where:{id:workspace.id},data:update});
   await tx.platformAudit.create({data:{
    actorId:admin.userId,workspaceId:workspace.id,
    detail:JSON.stringify({action:'independent_billing_manual_adjustment',shopId:input.shopId,
     ownerId,previous:{plan:current.plan,status:current.subscriptionStatus},
     next:{plan:input.plan,status:input.status},periodEndsAt:current.subscriptionEndsAt?.toISOString()||null,
     note:input.reason,paymentRecorded:false})
   }});
   return {plan:input.plan,status:input.status,periodEndsAt:current.subscriptionEndsAt?.toISOString()||null};
  },{timeout:15000});
  return respond({ok:true,...result});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Données invalides'},400);
  return respond({error:'Modification administrative indisponible'},503);
 }
}
