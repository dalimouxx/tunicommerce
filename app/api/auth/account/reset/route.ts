import {consumeAccountInput,consumeAccountAction} from '../../../../../modules/auth/account-actions';
import {assertSameOrigin,readJson,respond} from '../../../../../modules/auth/http';
import {authError} from '../../../../../modules/auth/validation';

export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  await consumeAccountAction('RESET_PASSWORD',consumeAccountInput.parse(await readJson(request,4000)));
  return respond({ok:true});
 }catch(error){return authError(error);}
}
