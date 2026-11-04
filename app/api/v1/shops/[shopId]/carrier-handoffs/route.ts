import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../../../modules/shops/isolated-commerce';
import {carrierHandoffInput,carrierHandoffOverview,parseHandoffPages,performCarrierHandoff} from '../../../../../../modules/shops/carrier-handoffs';

export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(request:Request,context:Context){
 try{
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  const pages=parseHandoffPages(new URL(request.url).searchParams);
  const commerce=await readIsolatedCommerce(shopId,shop.name);
  if(!commerce.initialized)return respond({error:'Initialisez votre boutique'},409);
  return respond({...carrierHandoffOverview(commerce.state,pages),version:commerce.version});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Remises aux transporteurs indisponibles'},503);
 }
}
export async function POST(request:Request,context:Context){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const input=carrierHandoffInput.parse(await readJson(request,6000));
  const {shopId}=await context.params;
  const result=await performCarrierHandoff(actor.userId,shopId,input);
  return respond({...carrierHandoffOverview(result.state),version:result.version,alreadyApplied:result.alreadyApplied});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Données invalides'},400);
  return respond({error:'Déclaration de remise impossible'},503);
 }
}
