import {z} from 'zod';
import {prisma} from '../../../../../../modules/storage/client';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {canPublishIsolatedShop} from '../../../../../../modules/shops/publication';
import {normalizeState} from '../../../../../../modules/commerce/normalize';
import type {State} from '../../../../../../modules/commerce/types';

export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
const mutation=z.object({published:z.boolean()}).strict();

export async function POST(request:Request,context:Context){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const input=mutation.parse(await readJson(request,2000));
  const result=await prisma.$transaction(async tx=>{
   const member=await tx.membership.findUnique({where:{shopId_userId:{shopId,userId:actor.userId}},
    select:{active:true,role:true,shop:{select:{id:true,slug:true,status:true,legacyWorkspaceId:true,
     commerce:{select:{data:true}},
     organization:{select:{ownerId:true}}
    }}}});
   if(!member?.active||member.role!=='OWNER'||member.shop.legacyWorkspaceId!==null)
    throw new HttpError(403,'Publication interdite pour cette boutique');
   const shop=member.shop;
   if(input.published){
    const subscription=await tx.workspace.findUnique({where:{ownerId:shop.organization.ownerId},
     select:{subscriptionStatus:true,subscriptionEndsAt:true}});
    const state=shop.commerce?normalizeState(shop.commerce.data as unknown as State):null;
    if(!canPublishIsolatedShop({
     legacyWorkspaceId:shop.legacyWorkspaceId,memberActive:member.active,memberRole:member.role,
     initialized:!!state,activeProducts:state?.products.filter(p=>p.active).length||0,
     subscriptionStatus:subscription?.subscriptionStatus||'',
     subscriptionEndsAt:subscription?.subscriptionEndsAt||null
    }))throw new HttpError(409,'Initialisez le catalogue et activez un abonnement marchand valide avant publication.');
   }
   await tx.shop.update({where:{id:shopId},data:{status:input.published?'PUBLISHED':'DRAFT'}});
   return {published:input.published,slug:shop.slug};
  });
  return respond(result);
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Publication invalide'},400);
  return respond({error:'Publication indisponible'},503);
 }
}
