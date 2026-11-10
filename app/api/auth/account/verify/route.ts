import {consumeAccountInput,consumeAccountAction,requestAccountAction} from '../../../../../modules/auth/account-actions';
import {getCurrentUser,getSuperAdminUser} from '../../../../../modules/auth/session';
import {z} from 'zod';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../modules/auth/http';
import {authError} from '../../../../../modules/auth/validation';

export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  const input=consumeAccountInput.omit({password:true}).parse(await readJson(request,2000));
  await consumeAccountAction('VERIFY_EMAIL',input);
  return respond({ok:true});
 }catch(error){return authError(error);}
}
export async function PUT(request:Request){
 try{
  assertSameOrigin(request);
  const input=z.object({portal:z.enum(['ADMIN','MERCHANT']).default('MERCHANT')}).strict().parse(await readJson(request,1000));
  const user=input.portal==='ADMIN'?await getSuperAdminUser():await getCurrentUser();
  if(!user)throw new HttpError(401,'Connexion requise');
  await requestAccountAction(user.email,'VERIFY_EMAIL',input.portal);
  return respond({ok:true,message:'Demande de vérification enregistrée.'},202);
 }catch(error){return authError(error);}
}
