import {z} from 'zod';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../../../../modules/auth/http';
import {isolatedCustomerRequestInput,submitIsolatedCustomerRequest} from '../../../../../../../../../modules/shops/public-customer-request';

export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{slug:string;token:string}>}){
 try{
  assertSameOrigin(request);
  const {slug,token}=await context.params;
  const input=isolatedCustomerRequestInput.parse(await readJson(request,3000));
  const result=await submitIsolatedCustomerRequest(slug,token,input);
  return respond(result,result.alreadyApplied?200:201);
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Demande invalide'},400);
  return respond({error:'Demande temporairement indisponible'},503);
 }
}
