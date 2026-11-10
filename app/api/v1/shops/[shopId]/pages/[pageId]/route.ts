import {getCurrentUser} from '../../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../../modules/auth/http';
import {authError} from '../../../../../../../modules/auth/validation';
import {changePageInput,deletePageInput} from '../../../../../../../modules/shops/page-content';
import {changeShopPage,deleteShopPage} from '../../../../../../../modules/shops/page-service';
type Context={params:Promise<{shopId:string;pageId:string}>};
export async function PUT(request:Request,context:Context){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');
  const input=changePageInput.parse(await readJson(request,32000)),{shopId,pageId}=await context.params;
  return respond({page:await changeShopPage(actor.userId,shopId,pageId,input)});
 }catch(error){return authError(error);}
}
export async function DELETE(request:Request,context:Context){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');
  const input=deletePageInput.parse(await readJson(request,1000)),{shopId,pageId}=await context.params;
  await deleteShopPage(actor.userId,shopId,pageId,input.version);return respond({ok:true});
 }catch(error){return authError(error);}
}
