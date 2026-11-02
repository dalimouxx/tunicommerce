import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {teamWriteInput,performTeamAction} from '../../../../../../modules/shops/team-actions';

export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function POST(req:Request,context:Context){
 try{
  assertSameOrigin(req);
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const input=teamWriteInput.parse(await readJson(req,5000));
  const {shopId}=await context.params;
  const result=await performTeamAction(actor.userId,shopId,input);
  // Never return the full State: it includes customer PII, prices and operational secrets.
  return respond({success:true,version:result.version,alreadyApplied:result.alreadyApplied});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Champs invalides'},400);
  return respond({error:'Action indisponible'},503);
 }
}
