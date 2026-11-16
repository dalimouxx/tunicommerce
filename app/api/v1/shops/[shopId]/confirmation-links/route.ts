import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {prepareConfirmationLink} from '../../../../../../modules/shops/order-confirmation-service';
export const dynamic='force-dynamic';
const input=z.object({orderId:z.string().min(1).max(160)}).strict();
/** Prepares (or reuses) the customer's confirmation link and the WhatsApp message to send it. */
export async function POST(req:Request,context:{params:Promise<{shopId:string}>}){
 try{
  assertSameOrigin(req);
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const {orderId}=input.parse(await readJson(req,1000));
  const {shopId}=await context.params;
  return respond(await prepareConfirmationLink(actor.userId,shopId,orderId));
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:'Commande invalide'},400);
  return respond({error:'Lien de confirmation indisponible'},503);
 }
}
