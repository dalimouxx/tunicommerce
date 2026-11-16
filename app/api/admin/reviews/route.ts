import {z} from 'zod';
import {requireAdmin} from '../../../../modules/platform/admin';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {moderationInput} from '../../../../modules/reviews/policy';
import {moderateReview,reportedReviews} from '../../../../modules/reviews/service';
export const dynamic='force-dynamic';
export async function GET(){
 try{await requireAdmin();return respond({items:await reportedReviews()});}
 catch(error){if(error instanceof HttpError)return respond({error:error.message},error.status);return respond({error:'Avis signalés indisponibles'},503);}
}
export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const actor=await requireAdmin();
  const input=moderationInput.parse(await readJson(req,1000));
  await moderateReview(actor.userId,input);
  return respond({items:await reportedReviews()});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Décision invalide'},400);
  return respond({error:'Décision impossible'},503);
 }
}
