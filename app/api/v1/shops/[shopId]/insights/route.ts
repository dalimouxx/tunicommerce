import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../../../modules/shops/isolated-commerce';
import {merchantInsights} from '../../../../../../modules/shops/merchant-insights';
export const dynamic='force-dynamic';
export async function GET(_req:Request,context:{params:Promise<{shopId:string}>}){
 try{
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  const commerce=await readIsolatedCommerce(shopId,shop.name);
  if(!commerce.initialized)return respond({error:'Initialisez votre boutique'},409);
  return new Response(JSON.stringify(merchantInsights(commerce.state)),{
   status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff'}
  });
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Analyses indisponibles'},503);
 }
}
