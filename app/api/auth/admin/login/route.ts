import {assertSameOrigin,readJson,respond} from '../../../../../modules/auth/http';
import {authenticate} from '../../../../../modules/auth/service';
import {createSession} from '../../../../../modules/auth/session';
import {credentials,authError} from '../../../../../modules/auth/validation';
export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  const input=credentials.parse(await readJson(request,8000));
  const user=await authenticate(input.email,input.password,'ADMIN');
  await createSession(user.id,'ADMIN');
  return respond({ok:true,next:'/admin'});
 }catch(error){return authError(error);}
}
