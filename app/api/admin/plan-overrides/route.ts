import {z} from 'zod';
import {prisma} from '../../../../modules/storage/client';
import {requireAdmin} from '../../../../modules/platform/admin';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {overrideInput} from '../../../../modules/subscriptions/validation';

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const actor=await requireAdmin();
  const input=overrideInput.parse(await readJson(req,8000));
  const result=await prisma.$transaction(async tx=>{
   const workspace=await tx.workspace.findUnique({where:{id:input.workspaceId},select:{id:true,plan:true}});
   if(!workspace)throw new HttpError(404,'Boutique introuvable');
   const existing=await tx.workspacePlanOverride.findUnique({where:{workspaceId:input.workspaceId}});
   const override=await tx.workspacePlanOverride.upsert({
    where:{workspaceId:input.workspaceId},create:input,update:{
     maxProducts:input.maxProducts,maxOrdersPerMonth:input.maxOrdersPerMonth,
     maxPhotos:input.maxPhotos,note:input.note
    }
   });
   await tx.platformAudit.create({data:{
    actorId:actor.userId,workspaceId:input.workspaceId,
    detail:JSON.stringify({action:'override',plan:workspace.plan,
     old:existing?{maxProducts:existing.maxProducts,maxOrdersPerMonth:existing.maxOrdersPerMonth,maxPhotos:existing.maxPhotos,note:existing.note}:null,
     next:input})
   }});
   return override;
  });
  return respond({override:result});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Champs invalides'},400);
  return respond({error:'Impossible d’enregistrer cette exception'},503);
 }
}
