import {assertSameOrigin,respond} from '../../../../../modules/auth/http';
import {revokeSession} from '../../../../../modules/auth/session';
import {authError} from '../../../../../modules/auth/validation';
export async function POST(request:Request){
 try{assertSameOrigin(request);await revokeSession('ADMIN');return respond({ok:true});}
 catch(error){return authError(error);}
}
