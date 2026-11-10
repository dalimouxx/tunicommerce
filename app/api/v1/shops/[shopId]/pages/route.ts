import {getCurrentUser} from '../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../modules/auth/http';
import {authError} from '../../../../../../modules/auth/validation';
import {createPageInput} from '../../../../../../modules/shops/page-content';
import {listShopPages,createShopPage} from '../../../../../../modules/shops/page-service';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_request:Request,context:Context){
 try{
  const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');
  return respond(await listShopPages(actor.userId,(await context.params).shopId));
 }catch(error){return authError(error);}
}
export async function POST(request:Request,context:Context){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');
  const input=createPageInput.parse(await readJson(request,32000));
  return respond({page:await createShopPage(actor.userId,(await context.params).shopId,input)},201);
 }catch(error){return authError(error);}
}
