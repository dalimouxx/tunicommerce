import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {callCenterAssignmentInput,assignCallCenterAgent} from '../../../../../../modules/shops/call-center-assignment';
export const dynamic='force-dynamic';

export async function POST(req:Request,context:{params:Promise<{shopId:string}>}){
 try{
  assertSameOrigin(req);
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const input=callCenterAssignmentInput.parse(await readJson(req,3000));
  return respond(await assignCallCenterAgent(user.userId,shopId,input));
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Attribution invalide'},400);
  return respond({error:'Attribution indisponible'},503);
 }
}
