import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../../../modules/shops/isolated-commerce';
import {writeIsolatedCommerce} from '../../../../../../modules/shops/aggregate-quotas';
import {quantityOffersMutation} from '../../../../../../modules/shops/quantity-offers';
import type {State} from '../../../../../../modules/commerce/types';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
const view=(state:State)=>({products:state.products.filter(p=>p.active).map(p=>({
 id:p.id,name:p.name,variant:p.variant,price:p.price,offers:p.quantityOffers||[]
}))});
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(_req:Request,context:Context){
 try{
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  const commerce=await readIsolatedCommerce(shopId,shop.name);
  if(!commerce.initialized)return respond({error:'Initialisez cette boutique'},409);
  return new Response(JSON.stringify(view(commerce.state)),{headers});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Offres indisponibles'},503);
 }
}
export async function POST(req:Request,context:Context){
 try{
  assertSameOrigin(req);
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const input=quantityOffersMutation.parse(await readJson(req,6000));
  const {shopId}=await context.params;
  const result=await writeIsolatedCommerce(actor.userId,shopId,input,()=>{});
  return respond({...view(result.state),alreadyApplied:result.alreadyApplied});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Offres invalides'},400);
  return respond({error:'Enregistrement des offres impossible'},503);
 }
}
