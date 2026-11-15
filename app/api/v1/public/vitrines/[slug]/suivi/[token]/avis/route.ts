import {z} from 'zod';
import {assertPublicStorefrontOrigin} from '../../../../../../../../../modules/shops/domains-routing';
import {readJson,respond,HttpError} from '../../../../../../../../../modules/auth/http';
import {reviewInput} from '../../../../../../../../../modules/reviews/policy';
import {submitReview} from '../../../../../../../../../modules/reviews/service';

export const dynamic='force-dynamic';
/** Verified review: only the bearer of the private tracking link of a delivered order may post. */
export async function POST(request:Request,context:{params:Promise<{slug:string;token:string}>}){
 try{
  const {slug,token}=await context.params;
  await assertPublicStorefrontOrigin(request,slug);
  const input=reviewInput.parse(await readJson(request,3000));
  const result=await submitReview(slug,token,input);
  return respond(result,result.alreadyReviewed?200:201);
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Avis invalide'},400);
  return respond({error:'Avis temporairement indisponible'},503);
 }
}
