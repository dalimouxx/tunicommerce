import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {prisma} from '../../../../modules/storage/client';
import {requireAdmin} from '../../../../modules/platform/admin';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {hashPassword} from '../../../../modules/auth/crypto';
import {initialState} from '../../../../modules/commerce/seed';
import {legacyShopName} from '../../../../modules/platform/admin-overview';
import {planCode} from '../../../../modules/subscriptions/validation';

const config=z.object({
 slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60),
 published:z.boolean(),
 plan:planCode,
 subscriptionStatus:z.enum(['TRIAL','ACTIVE','SUSPENDED','CANCELLED']),
 subscriptionEndsAt:z.string().datetime()
});
const actionSchema=z.discriminatedUnion('action',[
 z.object({
  action:z.literal('create'),name:z.string().trim().min(2).max(100),
  email:z.string().email().transform(v=>v.toLowerCase()),
  password:z.string().min(12).max(128),
  shopName:z.string().trim().min(2).max(100)
 }).merge(config),
 z.object({action:z.literal('update'),id:z.string().uuid()}).merge(config),
 z.object({action:z.literal('link'),id:z.string().uuid()})
]);

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const actor=await requireAdmin();
  const input=actionSchema.parse(await readJson(req,12000));
  const passwordHash=input.action==='create'?await hashPassword(input.password):null;

  const result=await prisma.$transaction(async tx=>{
   if(input.action==='link'){
    const workspace=await tx.workspace.findUnique({
     where:{id:input.id},
     select:{
      id:true,ownerId:true,slug:true,data:true,published:true,
      shop:{select:{id:true}}
     }
    });
    if(!workspace)throw new HttpError(404,'Boutique introuvable');
    if(workspace.shop)return {ok:true,shopId:workspace.shop.id,alreadyLinked:true};
    if(!workspace.slug)throw new HttpError(409,'Configurez le lien public de la boutique avant de créer sa structure');
    const conflict=await tx.shop.findUnique({where:{slug:workspace.slug},select:{id:true}});
    if(conflict)throw new HttpError(409,'Ce lien est déjà réservé par une autre boutique');

    const existingOrg=await tx.organization.findFirst({
     where:{ownerId:workspace.ownerId},orderBy:{createdAt:'asc'},select:{id:true}
    });
    const organizationId=existingOrg?.id||(await tx.organization.create({
     data:{ownerId:workspace.ownerId,name:legacyShopName(workspace.data)},select:{id:true}
    })).id;
    const shop=await tx.shop.create({data:{
     organizationId,legacyWorkspaceId:workspace.id,slug:workspace.slug,
     name:legacyShopName(workspace.data),
     status:workspace.published?'PUBLISHED':'DRAFT',
     memberships:{create:{userId:workspace.ownerId,role:'OWNER'}}
    },select:{id:true}});
    await tx.platformAudit.create({
     data:{actorId:actor.userId,workspaceId:workspace.id,
      detail:JSON.stringify({action:'link',shopId:shop.id})}
    });
    return {ok:true,shopId:shop.id,alreadyLinked:false};
   }

   const selectedPlan=await tx.subscriptionPlan.findUnique({
    where:{code:input.plan},select:{enabled:true}
   });
   if(!selectedPlan?.enabled)throw new HttpError(409,'Offre inexistante ou désactivée');
   const data={
    slug:input.slug,published:input.published,plan:input.plan,
    subscriptionStatus:input.subscriptionStatus,
    subscriptionEndsAt:new Date(input.subscriptionEndsAt)
   };
   let workspaceId:string;
   let shopId:string|null=null;

   if(input.action==='create'){
    const state=initialState(false);
    state.shop.name=input.shopName;
    state.shop.address='';
    const owner=await tx.user.create({
     data:{email:input.email,name:input.name,passwordHash:passwordHash!,role:'MERCHANT'},
     select:{id:true}
    });
    const workspace=await tx.workspace.create({
     data:{...data,ownerId:owner.id,data:state as unknown as Prisma.InputJsonValue},
     select:{id:true}
    });
    workspaceId=workspace.id;
    const organization=await tx.organization.create({
     data:{ownerId:owner.id,name:input.shopName},select:{id:true}
    });
    const shop=await tx.shop.create({data:{
     organizationId:organization.id,legacyWorkspaceId:workspace.id,
     name:input.shopName,slug:input.slug,
     status:input.published?'PUBLISHED':'DRAFT',
     memberships:{create:{userId:owner.id,role:'OWNER'}}
    },select:{id:true}});
    shopId=shop.id;
   }else{
    workspaceId=input.id;
    const current=await tx.workspace.findUnique({
     where:{id:input.id},select:{id:true,shop:{select:{id:true}}}
    });
    if(!current)throw new HttpError(404,'Boutique introuvable');
    const reserved=await tx.shop.findUnique({
     where:{slug:input.slug},select:{legacyWorkspaceId:true}
    });
    if(reserved&&reserved.legacyWorkspaceId!==input.id)
     throw new HttpError(409,'Ce lien est déjà réservé par une autre boutique');
    await tx.workspace.update({where:{id:input.id},data});
    // Keep the new Shop directory in sync with the live Workspace storefront.
    await tx.shop.updateMany({
     where:{legacyWorkspaceId:input.id},
     data:{slug:input.slug,status:input.published?'PUBLISHED':'DRAFT'}
    });
    shopId=current.shop?.id||null;
   }
   await tx.platformAudit.create({
    data:{actorId:actor.userId,workspaceId,
     detail:JSON.stringify({
      action:input.action,slug:input.slug,plan:input.plan,
      subscriptionStatus:input.subscriptionStatus,
      subscriptionEndsAt:data.subscriptionEndsAt.toISOString(),
      published:input.published
     })}
   });
   return {ok:true,workspaceId,shopId};
  });
  return respond(result);
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Entrée invalide'},400);
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')
   return respond({error:'Cet e-mail ou ce lien de boutique existe déjà.'},409);
  return respond({error:'Enregistrement impossible'},503);
 }
}
