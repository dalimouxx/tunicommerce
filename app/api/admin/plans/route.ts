import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../../../../modules/storage/client';
import {requireAdmin} from '../../../../modules/platform/admin';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {planInput} from '../../../../modules/subscriptions/validation';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  await requireAdmin();
  const plans=await prisma.subscriptionPlan.findMany({orderBy:{code:'asc'}});
  const assigned=await prisma.workspace.groupBy({
   by:['plan'],_count:{_all:true}
  });
  return respond({plans,assigned:Object.fromEntries(assigned.map(row=>[row.plan,row._count._all]))});
 }catch(e){if(e instanceof HttpError)return respond({error:e.message},e.status);
  return respond({error:'Catalogue des offres indisponible'},503);}
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const actor=await requireAdmin();
  const input=planInput.parse(await readJson(req,16000));
  const result=await prisma.$transaction(async tx=>{
   const previous=await tx.subscriptionPlan.findUnique({where:{code:input.code}});
   const data={
    name:input.name,description:input.description,priceMillimes:input.priceMillimes,
    durationDays:input.durationDays,maxProducts:input.maxProducts,
    maxOrdersPerMonth:input.maxOrdersPerMonth,maxPhotos:input.maxPhotos,
    maxShops:input.maxShops,maxMembers:input.maxMembers,
    modules:input.modules as unknown as Prisma.InputJsonValue,enabled:input.enabled
   };
   // Refuse disabling plans that are currently assigned: existing storefronts must remain manageable.
   if(!input.enabled&&await tx.workspace.count({where:{plan:input.code}})>0)
    throw new HttpError(409,'Offre utilisée : attribuez un autre plan aux boutiques avant de la désactiver.');
   const saved=await tx.subscriptionPlan.upsert({
    where:{code:input.code},
    create:{code:input.code,...data},
    update:data
   });
   await tx.subscriptionPlanAudit.create({
    data:{actorId:actor.userId,planCode:input.code,details:{
     action:previous?'update':'create',
     old:previous?{
      name:previous.name,description:previous.description,priceMillimes:previous.priceMillimes,
      durationDays:previous.durationDays,maxProducts:previous.maxProducts,
      maxOrdersPerMonth:previous.maxOrdersPerMonth,maxPhotos:previous.maxPhotos,
      maxShops:previous.maxShops,maxMembers:previous.maxMembers,
      modules:previous.modules,enabled:previous.enabled
     }:null,
     next:input
    } as unknown as Prisma.InputJsonValue}
   });
   return saved;
  });
  return respond({plan:result});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Données invalides'},400);
  return respond({error:'Impossible de sauvegarder cette offre'},503);
 }
}
