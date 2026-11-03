import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner} from '../../../../../../modules/shops/isolated-commerce';
import {expenseMutation,performShopExpenseAction} from '../../../../../../modules/shops/expenses';
import {prisma} from '../../../../../../modules/storage/client';
import {normalizeState} from '../../../../../../modules/commerce/normalize';
import type {State} from '../../../../../../modules/commerce/types';

export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};

export async function GET(_request:Request,context:Context){
 try{
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  await requireIsolatedOwner(actor.userId,shopId);
  const row=await prisma.shopCommerce.findUnique({where:{shopId},select:{data:true,version:true}});
  if(!row)return respond({error:'Initialisez votre boutique'},409);
  const state=normalizeState(row.data as unknown as State);
  return respond({expenses:state.expenses.slice(0,100),version:row.version});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Dépenses indisponibles'},503);
 }
}

export async function POST(request:Request,context:Context){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const input=expenseMutation.parse(await readJson(request,12000));
  const {shopId}=await context.params;
  const result=await performShopExpenseAction(actor.userId,shopId,input);
  return respond({expenses:result.state.expenses.slice(0,100),version:result.version,alreadyApplied:result.alreadyApplied});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Dépense invalide'},400);
  if(error instanceof Error&&error.message==='Date de dépense invalide')return respond({error:error.message},400);
  return respond({error:'Enregistrement indisponible'},503);
 }
}
