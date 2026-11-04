import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../../../modules/shops/isolated-commerce';
import {codAuditRows,codAuditCsv} from '../../../../../../modules/shops/cod-exceptions';

export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{shopId:string}>}){
 try{
  const actor=await getCurrentUser();
  if(!actor)return Response.json({error:'Connexion requise'},{status:401,headers:{'Cache-Control':'no-store'}});
  const {shopId}=await context.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  const commerce=await readIsolatedCommerce(shopId,shop.name);
  if(!commerce.initialized)throw new HttpError(409,'Initialisez votre boutique');
  const data=codAuditCsv(codAuditRows(commerce.state));
  return new Response(data,{status:200,headers:{
   'Content-Type':'text/csv; charset=utf-8',
   'Content-Disposition':'attachment; filename="audit-cod-tunicommerce.csv"',
   'Cache-Control':'private, no-store',
   'X-Content-Type-Options':'nosniff'
  }});
 }catch(error){
  if(error instanceof HttpError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
  return Response.json({error:'Export COD indisponible'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
