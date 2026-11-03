import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner} from '../../../../../../modules/shops/isolated-commerce';
import {isolatedCustomerDirectory} from '../../../../../../modules/shops/customer-directory';
import {prisma} from '../../../../../../modules/storage/client';
import {normalizeState} from '../../../../../../modules/commerce/normalize';
import type {State} from '../../../../../../modules/commerce/types';

export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_req:Request,context:Context){
 try{
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  await requireIsolatedOwner(actor.userId,shopId);
  const commerce=await prisma.shopCommerce.findUnique({where:{shopId},select:{data:true}});
  if(!commerce)return respond({error:'Initialisez votre boutique'},409);
  const state=normalizeState(commerce.data as unknown as State);
  return respond({customers:isolatedCustomerDirectory(state)});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Répertoire clients temporairement indisponible'},503);
 }
}
