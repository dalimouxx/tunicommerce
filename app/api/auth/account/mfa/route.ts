import {z} from 'zod';
import {getCurrentUser,getSuperAdminUser,currentSessionHash} from '../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../modules/auth/http';
import {authError} from '../../../../../modules/auth/validation';
import {consumeAttempt} from '../../../../../modules/auth/service';
import {beginMfa,configureMfa} from '../../../../../modules/auth/mfa';

const input=z.object({action:z.enum(['begin','confirm','disable','recovery']),
 portal:z.enum(['ADMIN','MERCHANT']).default('MERCHANT'),password:z.string().min(1).max(128),otp:z.string().trim().max(32).default('')}).strict();
export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  const data=input.parse(await readJson(request,4000));
  const actor=data.portal==='ADMIN'?await getSuperAdminUser():await getCurrentUser();
  if(!actor)throw new HttpError(401,'Connexion requise');
  await consumeAttempt('mfa-settings:'+actor.userId,10);
  if(data.action==='begin')return respond(await beginMfa(actor.userId,data.password));
  return respond(await configureMfa(actor.userId,{...data,action:data.action},await currentSessionHash(data.portal)));
 }catch(error){return authError(error);}
}
