import {assertSameOrigin,readJson,respond} from '../../../../modules/auth/http';
import {setupOwner} from '../../../../modules/auth/service';
import {ownerInput,authError} from '../../../../modules/auth/validation';
export async function POST(req:Request){try{assertSameOrigin(req);const input=ownerInput.parse(await readJson(req,8000));await setupOwner(input);return respond({ok:true},201);}catch(e){return authError(e);}}
