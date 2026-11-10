import {setTimeout as pause} from 'node:timers/promises';
import {accountRequestInput,requestAccountAction} from '../../../../../modules/auth/account-actions';
import {assertSameOrigin,readJson,respond} from '../../../../../modules/auth/http';
import {authError} from '../../../../../modules/auth/validation';

export async function POST(request:Request){
 const started=Date.now();
 try{
  assertSameOrigin(request);
  const input=accountRequestInput.parse(await readJson(request,4000));
  await requestAccountAction(input.email,'RESET_PASSWORD',input.portal);
  return respond({ok:true,message:'Si un compte correspond à ces informations, une demande de récupération a été enregistrée.'},202);
 }catch(error){return authError(error);}
 finally{await pause(Math.max(0,300-(Date.now()-started)));}
}
