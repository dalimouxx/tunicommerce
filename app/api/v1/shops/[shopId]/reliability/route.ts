import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,respond} from '../../../../../../modules/auth/http';
import {reliabilityForOrders} from '../../../../../../modules/reliability/service';
import {encryptionConfigured} from '../../../../../../modules/security/envelope';
export const dynamic='force-dynamic';
/** Shared delivery counts for the phones of this shop's own orders (?orders=id1,id2, at most 200). */
export async function GET(req:Request,context:{params:Promise<{shopId:string}>}){
 try{
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const ids=(new URL(req.url).searchParams.get('orders')||'').split(',').map(id=>id.trim()).filter(id=>id&&id.length<=160).slice(0,200);
  return respond({enabled:encryptionConfigured(),counts:await reliabilityForOrders(actor.userId,shopId,ids)});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Historique indisponible'},503);
 }
}
