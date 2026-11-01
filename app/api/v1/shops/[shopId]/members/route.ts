import {z} from 'zod';
import {prisma} from '../../../../../../modules/storage/client';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {respond,HttpError} from '../../../../../../modules/auth/http';
import {requireShopPermission} from '../../../../../../modules/shops/permissions';
import {shopIdInput} from '../../../../../../modules/shops/validation';

export const dynamic='force-dynamic';

export async function GET(_req:Request,context:{params:Promise<{shopId:string}>}){
 try{
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  shopIdInput.parse(shopId);
  await requireShopPermission(user.userId,shopId,'team.manage');
  const members=await prisma.membership.findMany({
   where:{shopId},
   select:{id:true,role:true,active:true,createdAt:true,user:{select:{id:true,name:true,email:true}}},
   orderBy:{createdAt:'asc'}
  });
  return respond({members});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:'Boutique invalide'},400);
  return respond({error:'Service temporairement indisponible'},503);
 }
}
