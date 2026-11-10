import {requireAdmin} from '../../../../../modules/platform/admin';
import {HttpError,respond} from '../../../../../modules/auth/http';
import {prisma} from '../../../../../modules/storage/client';
import {csvRow} from '../../../../../modules/billing/csv-export';
import {DIRECTORY_PAGE_SIZE,directoryPage,subscriptionDirectoryQuery} from '../../../../../modules/platform/subscription-directory';
import {billingBucket} from '../../../../../modules/platform/saas-billing-health';

export const dynamic='force-dynamic';
/** Same server filters and page as the admin screen. No unbounded or cross-role export. */
export async function GET(request:Request){
 try{
  await requireAdmin();
  const input=new URL(request.url).searchParams;
  const now=new Date();
  const query=subscriptionDirectoryQuery({
   statut:input.get('statut')||undefined,
   recherche:input.get('recherche')||undefined,
   offre:input.get('offre')||undefined,
   jours:input.get('jours')||undefined,
   page:input.get('page')||undefined
  },now);
  const count=await prisma.workspace.count({where:query.where});
  const paging=directoryPage(query.page,count);
  const records=await prisma.workspace.findMany({
   where:query.where,orderBy:[{subscriptionEndsAt:'asc'},{id:'asc'}],
   skip:(paging.page-1)*DIRECTORY_PAGE_SIZE,take:DIRECTORY_PAGE_SIZE,
   select:{
    id:true,slug:true,plan:true,subscriptionStatus:true,subscriptionEndsAt:true,
    owner:{select:{name:true,email:true}},shop:{select:{name:true}}
   }
  });
  const csv='\uFEFF'+csvRow([
   'ID boutique','Boutique','Slug','Marchand','Email marchand',
   'Plan','Statut administrateur','Situation abonnement','Echeance UTC'
  ])+records.map(row=>csvRow([
   row.id,row.shop?.name||'',row.slug||'',row.owner.name,row.owner.email,
   row.plan,row.subscriptionStatus,
   billingBucket({status:row.subscriptionStatus,endsAt:row.subscriptionEndsAt},now,query.windowDays),
   row.subscriptionEndsAt?.toISOString()||''
  ])).join('');
  return new Response(csv,{headers:{
   'Content-Type':'text/csv; charset=utf-8',
   'Content-Disposition':'attachment; filename="tunicommerce-abonnements-page-'+paging.page+'.csv"',
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Export indisponible'},503);
 }
}
