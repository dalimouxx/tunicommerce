import {requireAdmin} from '../../../../../modules/platform/admin';
import {HttpError,respond} from '../../../../../modules/auth/http';
import {financialReportCsv,financialReportQuery,FinancialReportInputError} from '../../../../../modules/billing/financial-report';
import {loadFinancialReport} from '../../../../../modules/billing/financial-report-service';

export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  await requireAdmin();
  const query=financialReportQuery(Object.fromEntries(new URL(request.url).searchParams));
  const report=await loadFinancialReport(query);
  return new Response(financialReportCsv(query,report.groups),{headers:{
   'Content-Type':'text/csv; charset=utf-8',
   'Content-Disposition':'attachment; filename="tunicommerce-finances-'+query.month+'.csv"',
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof FinancialReportInputError)return respond({error:error.message},400);
  return respond({error:'Rapport financier indisponible'},503);
 }
}
