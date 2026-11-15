import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {merchantReviewMutation} from '../../../../../../modules/reviews/policy';
import {applyMerchantReview,merchantReviews} from '../../../../../../modules/reviews/service';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_req:Request,context:Context){
 try{
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  return respond(await merchantReviews(actor.userId,shopId));
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Avis indisponibles'},503);
 }
}
export async function POST(req:Request,context:Context){
 try{
  assertSameOrigin(req);
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const input=merchantReviewMutation.parse(await readJson(req,3000));
  const {shopId}=await context.params;
  await applyMerchantReview(actor.userId,shopId,input);
  return respond(await merchantReviews(actor.userId,shopId));
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Action invalide'},400);
  return respond({error:'Action sur l’avis impossible'},503);
 }
}
