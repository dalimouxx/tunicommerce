import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../modules/auth/http';
import {authError} from '../../../../../../modules/auth/validation';
import {catalogQuery} from '../../../../../../modules/shops/catalog-query';
import {readCatalog,rebuildCatalog} from '../../../../../../modules/shops/catalog-index-service';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(request:Request,context:Context){
 try{
  const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');
  const query=catalogQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  return respond(await readCatalog(actor.userId,(await context.params).shopId,query));
 }catch(error){return authError(error);}
}
export async function POST(request:Request,context:Context){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');
  z.object({action:z.literal('refresh')}).strict().parse(await readJson(request,1000));
  return respond(await rebuildCatalog(actor.userId,(await context.params).shopId));
 }catch(error){return authError(error);}
}
