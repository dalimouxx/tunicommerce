import {getCurrentUser} from '../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../modules/auth/http';
import {authError} from '../../../../../../modules/auth/validation';
import {changeOrderMail} from '../../../../../../modules/messaging/order-mail';
import {readOrderMail,saveOrderMail} from '../../../../../../modules/messaging/order-mail-service';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_request:Request,context:Context){
 try{
  const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');
  return respond(await readOrderMail(actor.userId,(await context.params).shopId));
 }catch(error){return authError(error);}
}
export async function PUT(request:Request,context:Context){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');
  return respond(await saveOrderMail(actor.userId,(await context.params).shopId,changeOrderMail.parse(await readJson(request,32000))));
 }catch(error){return authError(error);}
}
