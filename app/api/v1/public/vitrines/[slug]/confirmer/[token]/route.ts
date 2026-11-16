import {z} from 'zod';
import {assertPublicStorefrontOrigin} from '../../../../../../../../modules/shops/domains-routing';
import {readJson,respond,HttpError} from '../../../../../../../../modules/auth/http';
import {publicConfirmationInput} from '../../../../../../../../modules/shops/order-confirmation';
import {submitCustomerConfirmation} from '../../../../../../../../modules/shops/order-confirmation-service';

export const dynamic='force-dynamic';
/** Customer answer from the private confirmation link sent to the order's phone. */
export async function POST(request:Request,context:{params:Promise<{slug:string;token:string}>}){
 try{
  const {slug,token}=await context.params;
  await assertPublicStorefrontOrigin(request,slug);
  const input=publicConfirmationInput.parse(await readJson(request,2000));
  const result=await submitCustomerConfirmation(slug,token,{answer:input.answer,...(input.note?{note:input.note}:{})});
  return respond(result);
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Réponse invalide'},400);
  return respond({error:'Confirmation temporairement indisponible'},503);
 }
}
