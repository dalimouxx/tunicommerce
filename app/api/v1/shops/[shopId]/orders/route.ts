import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner} from '../../../../../../modules/shops/isolated-commerce';
import {orderMutation,performShopOrderAction} from '../../../../../../modules/shops/orders';
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
  const row=await prisma.shopCommerce.findUnique({where:{shopId},select:{data:true,version:true}});
  if(!row)return respond({error:'Initialisez votre boutique'},409);
  const data=normalizeState(row.data as unknown as State);
  return respond({orders:data.orders,version:row.version});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Commandes indisponibles'},503);
 }
}
export async function POST(req:Request,context:Context){
 try{
  assertSameOrigin(req);
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const input=orderMutation.parse(await readJson(req,20000));
  const {shopId}=await context.params;
  const result=await performShopOrderAction(actor.userId,shopId,input);
  return respond({orders:result.state.orders,version:result.version,alreadyApplied:result.alreadyApplied});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Commande invalide'},400);
  return respond({error:'Traitement impossible'},503);
 }
}
