import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../modules/auth/http';
import {shopIdInput} from '../../../../../../modules/shops/validation';
import {inviteInput} from '../../../../../../modules/shops/team-validation';
import {inviteShopMember,listShopInvitations} from '../../../../../../modules/shops/team';

export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};

export async function GET(_req:Request,context:Context){
 try{
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  shopIdInput.parse(shopId);
  return respond({invitations:await listShopInvitations(user.userId,shopId)});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:'Boutique invalide'},400);
  return respond({error:'Service temporairement indisponible'},503);
 }
}

export async function POST(req:Request,context:Context){
 try{
  assertSameOrigin(req);
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  shopIdInput.parse(shopId);
  const input=inviteInput.parse(await readJson(req,8000));
  const invitation=await inviteShopMember(user.userId,shopId,input.email,input.role);
  return respond({invitation,delivery:'IN_APP_ONLY'},201);
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Données invalides'},400);
  return respond({error:'Invitation impossible'},503);
 }
}
