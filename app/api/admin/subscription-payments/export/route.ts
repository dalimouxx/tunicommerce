import {requireAdmin} from '../../../../../modules/platform/admin';
import {HttpError,respond} from '../../../../../modules/auth/http';
import {prisma} from '../../../../../modules/storage/client';
import {csvRow,millimesToTnd,paymentCsvColumns} from '../../../../../modules/billing/csv-export';
import {PAYMENT_PAGE_SIZE,paymentDirectoryPage,paymentDirectoryQuery} from '../../../../../modules/billing/payment-directory';

export const dynamic='force-dynamic';
const allowed=new Set(['ALL','PENDING','APPROVED','REJECTED']);
const MAX_ROWS=5000;

/** Export is intentionally separate from the operational payments API. */
export async function GET(request:Request){
 try{
  await requireAdmin();
  const url=new URL(request.url);
  const status=url.searchParams.get('status')||'ALL';
  if(!allowed.has(status))return respond({error:'Statut invalide'},400);
  const query=paymentDirectoryQuery({...Object.fromEntries(url.searchParams),status});
  const where=query.where;
  const total=await prisma.subscriptionPayment.count({where});
  const paginated=url.searchParams.has('page');
  const paging=paymentDirectoryPage(query.page,total);
  if(!paginated&&total>MAX_ROWS)return respond({error:'Export trop volumineux (maximum 5000 lignes). Filtrez les dossiers ou exportez une page depuis la liste des règlements.'},413);
  const records=await prisma.subscriptionPayment.findMany({
   where,orderBy:[{createdAt:'asc'},{id:'asc'}],
   skip:paginated?(paging.page-1)*PAYMENT_PAGE_SIZE:0,
   take:paginated?PAYMENT_PAGE_SIZE:MAX_ROWS,
   select:{
    reference:true,createdAt:true,planName:true,priceMillimes:true,
    durationDays:true,method:true,transferReference:true,status:true,
    decidedAt:true,periodStartsAt:true,periodEndsAt:true,
    workspace:{select:{slug:true,owner:{select:{name:true,email:true}}}}
   }
  });
  const csv='\uFEFF'+csvRow([...paymentCsvColumns])+records.map(p=>csvRow([
   p.reference,p.createdAt.toISOString(),p.workspace.slug||'',
   p.workspace.owner.name,p.workspace.owner.email,p.planName,
   millimesToTnd(p.priceMillimes),p.durationDays,p.method,
   p.transferReference||'',p.status,p.decidedAt?.toISOString()||'',
   p.periodEndsAt?.toISOString()||'',p.periodStartsAt?.toISOString()||''
  ])).join('');
  const filename='tunicommerce-reglements-'+status.toLowerCase()+(paginated?'-page-'+paging.page:'')+'.csv';
  return new Response(csv,{status:200,headers:{
   'Content-Type':'text/csv; charset=utf-8',
   'Content-Disposition':'attachment; filename="'+filename+'"',
   'Cache-Control':'private, no-store',
   'X-Content-Type-Options':'nosniff'
  }});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Export indisponible'},503);
 }
}
