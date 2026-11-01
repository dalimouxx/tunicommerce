import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../../../../modules/storage/client';
import {getCurrentUser} from '../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {newShopInput} from '../../../../modules/shops/validation';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const memberships=await prisma.membership.findMany({
   where:{userId:user.userId,active:true},
   select:{
    role:true,
    shop:{select:{id:true,name:true,slug:true,status:true,currency:true,language:true,timezone:true,
      organization:{select:{id:true,name:true}}}}
   },
   orderBy:{createdAt:'desc'}
  });
  return respond({shops:memberships.map(m=>({...m.shop,role:m.role}))});
 }catch{return respond({error:'Service temporairement indisponible'},503);}
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const input=newShopInput.parse(await readJson(req));
  const shop=await prisma.$transaction(async tx=>{
   const org=await tx.organization.findFirst({where:{id:input.organizationId,ownerId:user.userId},select:{id:true}});
   if(!org)throw new HttpError(403,'Organisation inaccessible');
   if(await tx.workspace.findUnique({where:{slug:input.slug},select:{id:true}}))
    throw new HttpError(409,'Ce lien de boutique est déjà utilisé');
   return tx.shop.create({
    data:{
     name:input.name,slug:input.slug,status:'DRAFT',
     organization:{connect:{id:org.id}},
     memberships:{create:{user:{connect:{id:user.userId}},role:'OWNER'}}
    },
    select:{id:true,name:true,slug:true,status:true,organizationId:true}
   });
  });
  return respond({shop},201);
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Champs invalides'},400);
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return respond({error:'Ce lien de boutique existe déjà'},409);
  return respond({error:'Création impossible'},503);
 }
}
