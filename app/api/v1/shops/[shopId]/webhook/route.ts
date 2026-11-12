import {getCurrentUser} from '../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../modules/auth/http';
import {authError} from '../../../../../../modules/auth/validation';
import {webhookAction} from '../../../../../../modules/messaging/webhook-policy';
import {readWebhookSettings,applyWebhookAction} from '../../../../../../modules/messaging/webhook-service';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_request:Request,context:Context){
 try{
  const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');
  const response=respond(await readWebhookSettings(actor.userId,(await context.params).shopId));
  response.headers.set('Referrer-Policy','no-referrer');return response;
 }catch(error){return authError(error);}
}
export async function POST(request:Request,context:Context){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');
  const input=webhookAction.parse(await readJson(request,12000));
  const response=respond(await applyWebhookAction(actor.userId,(await context.params).shopId,input));
  response.headers.set('Referrer-Policy','no-referrer');return response;
 }catch(error){return authError(error);}
}
