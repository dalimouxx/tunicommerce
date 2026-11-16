import {z} from 'zod';
import {createHash} from 'node:crypto';
import {assertPublicStorefrontOrigin} from '../../../../../../../../../modules/shops/domains-routing';
import {readJson,respond,HttpError} from '../../../../../../../../../modules/auth/http';
import {consumeAttempt} from '../../../../../../../../../modules/auth/service';
import {contestRefusal} from '../../../../../../../../../modules/reliability/service';
export const dynamic='force-dynamic';
const input=z.object({reason:z.string().trim().min(10,'Expliquez en quelques mots pourquoi ce refus est contesté').max(500,'Message trop long (500 caractères maximum)')}).strict();
/** The customer contests a recorded refusal from the private tracking link. */
export async function POST(request:Request,context:{params:Promise<{slug:string;token:string}>}){
 try{
  const {slug,token}=await context.params;
  await assertPublicStorefrontOrigin(request,slug);
  const {reason}=input.parse(await readJson(request,2000));
  await consumeAttempt('refusal-contest:'+createHash('sha256').update(slug+':'+token).digest('hex'),10);
  return respond(await contestRefusal(slug,token,reason),201);
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Contestation invalide'},400);
  return respond({error:'Contestation temporairement indisponible'},503);
 }
}
