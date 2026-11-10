import type {Prisma} from '@prisma/client';
import {csvRow,millimesToTnd} from './csv-export';

export const FINANCE_TIME_ZONE='Africa/Tunis';
export type FinancialReportInput={mois?:unknown;offre?:unknown;method?:unknown};
export class FinancialReportInputError extends Error{}
const calendar=new Intl.DateTimeFormat('en-GB',{
 timeZone:FINANCE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
 hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
});
function localParts(date:Date){
 return Object.fromEntries(calendar.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
function monthBoundary(year:number,month:number){
 const nominal=Date.UTC(year,month-1,1);
 let instant=nominal;
 for(let i=0;i<2;i++){
  const p=localParts(new Date(instant));
  instant-=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-nominal;
 }
 return new Date(instant);
}
export function financialReportQuery(input:FinancialReportInput,now=new Date()){
 const local=localParts(now);
 const defaultMonth=local.year+'-'+String(local.month).padStart(2,'0');
 const month=input.mois===undefined||input.mois===''?defaultMonth:input.mois;
 if(typeof month!=='string'||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month))
  throw new FinancialReportInputError('Choisissez un mois valide entre 2020 et 2100.');
 const [year,number]=month.split('-').map(Number);
 if(year<2020||year>2100)throw new FinancialReportInputError('Choisissez un mois valide entre 2020 et 2100.');
 const plan=input.offre??'',method=input.method??'';
 if(typeof plan!=='string'||(plan!==''&&!/^[A-Z][A-Z0-9_]{1,23}$/.test(plan)))
  throw new FinancialReportInputError('Offre invalide.');
 if(typeof method!=='string'||!['','D17','BANK_TRANSFER','CASH'].includes(method))
  throw new FinancialReportInputError('Moyen de règlement invalide.');
 const start=monthBoundary(year,number),end=monthBoundary(year,number+1);
 const previousMonth=new Date(Date.UTC(year,number-2,15)).toISOString().slice(0,7);
 const label=new Intl.DateTimeFormat('fr-TN',{timeZone:FINANCE_TIME_ZONE,month:'long',year:'numeric'}).format(new Date(start.getTime()+12*3600000));
 return {month,plan,method,start,end,label,previousMonth};
}
export type FinancialReportQuery=ReturnType<typeof financialReportQuery>;
export function previousFinancialReportQuery(query:FinancialReportQuery):FinancialReportQuery{
 const p=localParts(new Date(query.start.getTime()-86400000));
 const start=monthBoundary(p.year,p.month);
 return {...query,month:query.previousMonth,start,end:query.start,
  label:new Intl.DateTimeFormat('fr-TN',{timeZone:FINANCE_TIME_ZONE,month:'long',year:'numeric'}).format(new Date(start.getTime()+12*3600000)),
  previousMonth:new Date(Date.UTC(p.year,p.month-2,15)).toISOString().slice(0,7)};
}
export function financialReportWhere(query:FinancialReportQuery):Prisma.SubscriptionPaymentWhereInput{
 const range={gte:query.start,lt:query.end};
 return {
  ...(query.plan?{planCode:query.plan}:{}),...(query.method?{method:query.method}:{}),
  OR:[
   {status:'APPROVED',decidedAt:range},
   {status:'REJECTED',decidedAt:range},
   {status:'PENDING',createdAt:range}
  ]
 };
}
export function financialReportHref(path:string,query:Pick<FinancialReportQuery,'month'|'plan'|'method'>){
 const params=new URLSearchParams({mois:query.month});
 if(query.plan)params.set('offre',query.plan);
 if(query.method)params.set('method',query.method);
 return path+'?'+params.toString();
}
export type FinancialGroup={planCode:string;method:string;status:string;_count:{_all:number};_sum:{priceMillimes:number|null}};
export type FinancialTotals=Record<'APPROVED'|'PENDING'|'REJECTED',{count:number;millimes:number}>;
const empty=():FinancialTotals=>({APPROVED:{count:0,millimes:0},PENDING:{count:0,millimes:0},REJECTED:{count:0,millimes:0}});
export function summarizeFinancialGroups(groups:readonly FinancialGroup[]){
 const totals=empty(),plans=new Map<string,FinancialTotals>(),methods=new Map<string,FinancialTotals>();
 for(const row of groups){
  if(!['APPROVED','PENDING','REJECTED'].includes(row.status))continue;
  const status=row.status as keyof FinancialTotals;
  if(!plans.has(row.planCode))plans.set(row.planCode,empty());
  if(!methods.has(row.method))methods.set(row.method,empty());
  for(const bucket of [totals,plans.get(row.planCode)!,methods.get(row.method)!]){
   bucket[status].count+=row._count._all;
   bucket[status].millimes+=row._sum.priceMillimes||0;
  }
 }
 const rows=(map:Map<string,FinancialTotals>)=>Array.from(map,([key,totals])=>({key,totals})).sort((a,b)=>a.key.localeCompare(b.key,'fr'));
 return {totals,byPlan:rows(plans),byMethod:rows(methods)};
}
/** Each source group appears once. No total/subtotal rows that double count a payment. */
export function financialReportCsv(query:FinancialReportQuery,groups:readonly FinancialGroup[]){
 return '\uFEFF'+csvRow(['Mois (Tunisie)','Offre','Moyen','Statut administratif','Date de rattachement','Nombre de dossiers','Montant (TND)'])+
  groups.map(row=>csvRow([query.month,row.planCode,row.method,row.status,
   row.status==='PENDING'?'Dépôt':'Décision',row._count._all,millimesToTnd(row._sum.priceMillimes||0)])).join('');
}
