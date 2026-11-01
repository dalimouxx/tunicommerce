import {getCurrentUser} from '../../../modules/auth/session';
import {readWorkspace,saveWorkspace} from '../../../modules/storage/repository';
import {applyAction} from '../../../modules/commerce/service';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../modules/auth/http';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await getCurrentUser();if(!user)return respond({error:'Connexion requise'},401);if(!['ADMIN','MERCHANT'].includes(user.role))return respond({error:'Accès marchand requis'},403);return respond(await readWorkspace(user.userId));}catch{return respond({error:'Base de données indisponible'},503);}}
export async function POST(req:Request){
 try{
  assertSameOrigin(req);const user=await getCurrentUser();if(!user)return respond({error:'Connexion requise'},401);if(!['ADMIN','MERCHANT'].includes(user.role))return respond({error:'Accès marchand requis'},403);
  const body=z.object({action:z.string(),payload:z.unknown(),requestId:z.string().uuid()}).parse(await readJson(req));
  for(let attempt=0;attempt<4;attempt++){
   const {state,version}=await readWorkspace(user.userId);if(state.requests.includes(body.requestId))return respond({state,version});
   let next;try{next=applyAction(state,body.action,body.payload);}catch(e){return respond({error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'Action invalide'},400);}
   next.requests=[...state.requests.slice(-999),body.requestId];
   if(await saveWorkspace(user.userId,next,version))return respond({state:next,version:version+1});
  }
  return respond({error:'Modification simultanée. Actualisez et réessayez.'},409);
 }catch(e){if(e instanceof HttpError)return respond({error:e.message},e.status);if(e instanceof z.ZodError)return respond({error:e.issues[0].message},400);return respond({error:'Service temporairement indisponible'},503);}
}
