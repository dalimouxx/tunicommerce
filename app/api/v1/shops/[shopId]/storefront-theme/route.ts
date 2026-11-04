import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../../../modules/shops/isolated-commerce';
import {storefrontThemeInput,updateStorefrontTheme,storefrontThemeSummary} from '../../../../../../modules/shops/storefront-themes';

export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_request:Request,context:Context){
 try{
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  const commerce=await readIsolatedCommerce(shopId,shop.name);
  if(!commerce.initialized)return respond({error:'Initialisez votre boutique'},409);
  return respond({theme:storefrontThemeSummary(commerce.state)});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Thèmes indisponibles'},503);
 }
}
export async function POST(request:Request,context:Context){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const input=storefrontThemeInput.parse(await readJson(request,2000));
  const {shopId}=await context.params;
  const result=await updateStorefrontTheme(actor.userId,shopId,input);
  return respond({theme:storefrontThemeSummary(result.state),alreadyApplied:result.alreadyApplied});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Thème invalide'},400);
  return respond({error:'Enregistrement impossible'},503);
 }
}
