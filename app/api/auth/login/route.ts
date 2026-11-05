import {assertSameOrigin,readJson,respond} from '../../../../modules/auth/http';
import {authenticate} from '../../../../modules/auth/service';
import {createSession} from '../../../../modules/auth/session';
import {credentials,authError} from '../../../../modules/auth/validation';
export async function POST(req:Request){try{assertSameOrigin(req);const input=credentials.parse(await readJson(req,8000));const user=await authenticate(input.email,input.password,'MERCHANT');await createSession(user.id,'MERCHANT');return respond({ok:true,next:'/mes-boutiques'});}catch(e){return authError(e);}}
