import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {assertSameOrigin,respond,HttpError} from '../../../../../../modules/auth/http';
import {uuidParam} from '../../../../../../modules/shops/team-validation';
import {acceptShopInvitation} from '../../../../../../modules/shops/team';

export const dynamic='force-dynamic';
export async function POST(req:Request,context:{params:Promise<{invitationId:string}>}){
 try{
  assertSameOrigin(req);
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const {invitationId}=await context.params;
  uuidParam.parse(invitationId);
  const membership=await acceptShopInvitation(user,invitationId);
  return respond({membership},201);
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:'Invitation invalide'},400);
  return respond({error:'Acceptation impossible'},503);
 }
}
