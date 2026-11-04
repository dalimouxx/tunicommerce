import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../../../modules/shops/isolated-commerce';
import {brandingMutation,merchantBrandingView,performMerchantBranding} from '../../../../../../modules/shops/merchant-branding';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_req:Request,context:Context){
 try{
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  const commerce=await readIsolatedCommerce(shopId,shop.name);
  if(!commerce.initialized)return respond({error:'Initialisez cette boutique'},409);
  return new Response(JSON.stringify(merchantBrandingView(commerce.state)),{headers:{
   'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Identité de la boutique indisponible'},503);
 }
}
export async function POST(req:Request,context:Context){
 try{
  assertSameOrigin(req);
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const input=brandingMutation.parse(await readJson(req,8000));
  const {shopId}=await context.params;
  const result=await performMerchantBranding(actor.userId,shopId,input);
  return respond({...merchantBrandingView(result.state),alreadyApplied:result.alreadyApplied});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Paramètres invalides'},400);
  return respond({error:'Enregistrement de la vitrine impossible'},503);
 }
}
