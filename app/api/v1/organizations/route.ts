import {z} from 'zod';
import {getCurrentUser} from '../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {prisma} from '../../../../modules/storage/client';
import {organizationInput} from '../../../../modules/shops/validation';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const organizations=await prisma.organization.findMany({
   where:{ownerId:user.userId},
   select:{id:true,name:true,createdAt:true,shops:{select:{id:true,name:true,slug:true,status:true}}},
   orderBy:{createdAt:'desc'}
  });
  return respond({organizations});
 }catch{return respond({error:'Service temporairement indisponible'},503);}
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const {name}=organizationInput.parse(await readJson(req));
  const organization=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${user.userId}))`;
   const count=await tx.organization.count({where:{ownerId:user.userId}});
   if(count>=10)throw new HttpError(409,'Limite de groupes de boutiques atteinte');
   return tx.organization.create({data:{name,ownerId:user.userId},select:{id:true,name:true,createdAt:true}});
  });
  return respond({organization},201);
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Champs invalides'},400);
  return respond({error:'Création impossible'},503);
 }
}
