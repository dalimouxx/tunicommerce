import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,respond} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../../../modules/shops/isolated-commerce';
import {dispatchManifestPage,dispatchManifestCsv,parseDispatchManifestQuery} from '../../../../../../modules/shops/dispatch-manifest';

export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{shopId:string}>}){
 try{
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  const query=parseDispatchManifestQuery(new URL(request.url).searchParams);
  const commerce=await readIsolatedCommerce(shopId,shop.name);
  if(!commerce.initialized)throw new HttpError(409,'Initialisez votre boutique');
  const result=dispatchManifestPage(commerce.state,query);
  const {rows,...summary}=result;
  if(query.format==='json')return respond(summary);
  const csv=dispatchManifestCsv(rows);
  return new Response(csv,{status:200,headers:{
   'Content-Type':'text/csv; charset=utf-8',
   'Content-Disposition':'attachment; filename="expeditions-tunicommerce-'+query.status.toLowerCase()+'-p'+query.page+'.csv"',
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
   'X-Export-Page':String(result.page),
   'X-Export-Total-Pages':String(result.totalPages),
   'X-Export-Total-Rows':String(result.total)
  }});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Export indisponible'},503);
 }
}
