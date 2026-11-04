import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../../../modules/shops/isolated-commerce';
import {warehouseMutation,warehouseOverview} from '../../../../../../modules/warehouse/ledger';
import {performWarehouseAction} from '../../../../../../modules/shops/warehouse-operations';

export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_req:Request,context:Context){
 try{
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  const state=await readIsolatedCommerce(shopId,shop.name);
  if(!state.initialized)return respond({error:'Initialisez cette boutique'},409);
  return new Response(JSON.stringify(warehouseOverview(state.state)),{headers:{
   'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Dépôts indisponibles'},503);
 }
}
export async function POST(req:Request,context:Context){
 try{
  assertSameOrigin(req);
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const input=warehouseMutation.parse(await readJson(req,4000));
  const {shopId}=await context.params;
  const result=await performWarehouseAction(actor.userId,shopId,input);
  return respond({...warehouseOverview(result.state),alreadyApplied:result.alreadyApplied,version:result.version});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Données invalides'},400);
  return respond({error:'Opération dépôt indisponible'},503);
 }
}
