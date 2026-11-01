import {z} from 'zod';
import {getCurrentUser} from '../../../../../../../modules/auth/session';
import {assertSameOrigin,respond,HttpError} from '../../../../../../../modules/auth/http';
import {shopIdInput} from '../../../../../../../modules/shops/validation';
import {uuidParam} from '../../../../../../../modules/shops/team-validation';
import {revokeShopInvitation} from '../../../../../../../modules/shops/team';

export const dynamic='force-dynamic';
export async function POST(req:Request,context:{params:Promise<{shopId:string,invitationId:string}>}){
 try{
  assertSameOrigin(req);
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const {shopId,invitationId}=await context.params;
  shopIdInput.parse(shopId);
  uuidParam.parse(invitationId);
  return respond(await revokeShopInvitation(user.userId,shopId,invitationId));
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:'Identifiant invalide'},400);
  return respond({error:'Révocation impossible'},503);
 }
}
