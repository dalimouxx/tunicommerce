import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../../../modules/shops/isolated-commerce';
import {codAuditPage,codAuditCsv,parseCodAuditQuery} from '../../../../../../modules/shops/cod-exceptions';

export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{shopId:string}>}){
 try{
  const actor=await getCurrentUser();
  if(!actor)return Response.json({error:'Connexion requise'},{status:401,headers:{'Cache-Control':'no-store'}});
  const {shopId}=await context.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  const query=parseCodAuditQuery(new URL(request.url).searchParams);
  const commerce=await readIsolatedCommerce(shopId,shop.name);
  if(!commerce.initialized)throw new HttpError(409,'Initialisez votre boutique');
  const {rows,...summary}=codAuditPage(commerce.state,query);
  if(query.format==='json')return new Response(JSON.stringify(summary),{status:200,headers:{
   'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
   'X-Content-Type-Options':'nosniff',
   'X-Export-Page':String(summary.page),
   'X-Export-Total-Pages':String(summary.totalPages),
   'X-Export-Total-Rows':String(summary.total)
  }});
  const data=codAuditCsv(rows);
  return new Response(data,{status:200,headers:{
   'Content-Type':'text/csv; charset=utf-8',
   'Content-Disposition':'attachment; filename="audit-cod-tunicommerce-'+query.filter.toLowerCase()+'-p'+query.page+'.csv"',
   'Cache-Control':'private, no-store',
   'X-Content-Type-Options':'nosniff',
   'X-Export-Page':String(summary.page),
   'X-Export-Total-Pages':String(summary.totalPages),
   'X-Export-Total-Rows':String(summary.total)
  }});
 }catch(error){
  if(error instanceof HttpError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
  return Response.json({error:'Export COD indisponible'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
