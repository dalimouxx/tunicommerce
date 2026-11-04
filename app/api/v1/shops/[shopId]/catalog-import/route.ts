import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../../../../modules/auth/http';
import {bulkCatalogImportRequest,importShopCatalog} from '../../../../../../modules/shops/bulk-catalog-import';

export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{shopId:string}>}){
 try{
  assertSameOrigin(request);
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const input=bulkCatalogImportRequest.parse(await readJson(request,120000));
  const {shopId}=await context.params;
  const result=await importShopCatalog(actor.userId,shopId,input);
  return respond({ok:true,imported:input.payload.rows.length,alreadyApplied:result.alreadyApplied,
   totalProducts:result.state.products.length,version:result.version});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Import invalide'},400);
  return respond({error:'Import du catalogue impossible'},503);
 }
}
