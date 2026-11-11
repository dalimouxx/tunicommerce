import {z} from 'zod';
import {assertPublicStorefrontOrigin} from '../../../../../../../modules/shops/domains-routing';
import {HttpError,readJson,respond} from '../../../../../../../modules/auth/http';
import {createPublicCodOrder,publicCodCheckoutInput} from '../../../../../../../modules/shops/public-cod-checkout';

export const dynamic='force-dynamic';
type Context={params:Promise<{slug:string}>};

export async function POST(request:Request,context:Context){
 try{
  const {slug}=await context.params;
  await assertPublicStorefrontOrigin(request,slug);
  const input=publicCodCheckoutInput.parse(await readJson(request,12000));
  const result=await createPublicCodOrder(slug,input);
  return respond(result,result.alreadyApplied?200:201);
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Commande invalide'},400);
  return respond({error:'Commande momentanément indisponible'},503);
 }
}
