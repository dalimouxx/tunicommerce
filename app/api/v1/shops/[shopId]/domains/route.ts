import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../modules/auth/http';
import {domainMutation} from '../../../../../../modules/shops/domains-validation';
import {domainOverview,changeShopDomain} from '../../../../../../modules/shops/domains-service';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_request:Request,context:Context){
 try{const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');const {shopId}=await context.params;return respond(await domainOverview(actor.userId,shopId));}
 catch(error){if(error instanceof HttpError)return respond({error:error.message},error.status);return respond({error:'Domaines indisponibles'},503);}
}
export async function POST(request:Request,context:Context){
 try{assertSameOrigin(request);const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');const {shopId}=await context.params;const input=domainMutation.parse(await readJson(request,3000));await changeShopDomain(actor.userId,shopId,input);return respond(await domainOverview(actor.userId,shopId));}
 catch(error){if(error instanceof HttpError)return respond({error:error.message},error.status);if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Domaine invalide'},400);return respond({error:'Modification indisponible'},503);}
}
