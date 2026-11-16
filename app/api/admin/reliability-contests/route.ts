import {z} from 'zod';
import {requireAdmin} from '../../../../modules/platform/admin';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {decideContest,pendingContests} from '../../../../modules/reliability/service';
export const dynamic='force-dynamic';
const input=z.object({id:z.string().uuid(),decision:z.enum(['ACCEPTED','REJECTED'])}).strict();
export async function GET(){
 try{await requireAdmin();return respond({items:await pendingContests()});}
 catch(error){if(error instanceof HttpError)return respond({error:error.message},error.status);return respond({error:'Contestations indisponibles'},503);}
}
export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const actor=await requireAdmin();
  await decideContest(actor.userId,input.parse(await readJson(req,500)));
  return respond({items:await pendingContests()});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:'Décision invalide'},400);
  return respond({error:'Décision impossible'},503);
 }
}
