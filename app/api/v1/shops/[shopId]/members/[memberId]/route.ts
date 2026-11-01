import {z} from 'zod';
import {getCurrentUser} from '../../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../../modules/auth/http';
import {shopIdInput} from '../../../../../../../modules/shops/validation';
import {memberChangeInput,uuidParam} from '../../../../../../../modules/shops/team-validation';
import {changeShopMember} from '../../../../../../../modules/shops/team';

export const dynamic='force-dynamic';
export async function PATCH(req:Request,context:{params:Promise<{shopId:string,memberId:string}>}){
 try{
  assertSameOrigin(req);
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const {shopId,memberId}=await context.params;
  shopIdInput.parse(shopId);
  uuidParam.parse(memberId);
  const change=memberChangeInput.parse(await readJson(req,8000));
  const membership=await changeShopMember(user.userId,shopId,memberId,change);
  return respond({membership});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Données invalides'},400);
  return respond({error:'Modification impossible'},503);
 }
}
