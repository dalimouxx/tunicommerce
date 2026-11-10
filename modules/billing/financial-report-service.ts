import {prisma} from '../storage/client';
import {financialReportWhere,summarizeFinancialGroups,type FinancialReportQuery} from './financial-report';

/** PostgreSQL aggregates all matching payments without loading merchant/contact data. */
export async function loadFinancialReport(query:FinancialReportQuery){
 const groups=await prisma.subscriptionPayment.groupBy({
  by:['planCode','method','status'],where:financialReportWhere(query),
  orderBy:[{planCode:'asc'},{method:'asc'},{status:'asc'}],
  _count:{_all:true},_sum:{priceMillimes:true}
 });
 return {groups,...summarizeFinancialGroups(groups)};
}
