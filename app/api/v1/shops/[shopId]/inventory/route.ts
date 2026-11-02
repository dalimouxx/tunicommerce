import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner} from '../../../../../../modules/shops/isolated-commerce';
import {inventoryMutation,performShopInventoryAction} from '../../../../../../modules/shops/inventory';
import {prisma} from '../../../../../../modules/storage/client';
import type {State} from '../../../../../../modules/commerce/types';
import {normalizeState} from '../../../../../../modules/commerce/normalize';

export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_req:Request,context:Context){
 try{
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  await requireIsolatedOwner(actor.userId,shopId);
  const row=await prisma.shopCommerce.findUnique({where:{shopId},select:{data:true,version:true}});
  if(!row)return respond({error:'Initialisez cette boutique pour créer des produits'},409);
  const state=normalizeState(row.data as unknown as State);
  return respond({products:state.products,version:row.version});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Catalogue indisponible'},503);
 }
}
export async function POST(req:Request,context:Context){
 try{
  assertSameOrigin(req);
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const input=inventoryMutation.parse(await readJson(req,12000));
  const {shopId}=await context.params;
  const result=await performShopInventoryAction(actor.userId,shopId,input);
  return respond({products:result.state.products,version:result.version,alreadyApplied:result.alreadyApplied});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Champs invalides'},400);
  return respond({error:'Modification du catalogue indisponible'},503);
 }
}
