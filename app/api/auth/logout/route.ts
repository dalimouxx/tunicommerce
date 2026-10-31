import {assertSameOrigin,respond} from '../../../../modules/auth/http';
import {revokeSession} from '../../../../modules/auth/session';
import {authError} from '../../../../modules/auth/validation';
export async function POST(req:Request){try{assertSameOrigin(req);await revokeSession();return respond({ok:true});}catch(e){return authError(e);}}
