import {subscriptionOverview} from '../subscriptions/overview';

export type AccountExpiry={status:string;endsAt:Date|null};
export type BillingBucket='VALID'|'DUE_SOON'|'EXPIRED'|'SUSPENDED';
export function billingBucket(row:AccountExpiry,now=new Date(),windowDays=7):BillingBucket{
 if(row.status==='SUSPENDED'||row.status==='CANCELLED')return 'SUSPENDED';
 const state=subscriptionOverview(row.status,row.endsAt,now);
 if(!state.active)return 'EXPIRED';
 return row.endsAt!.getTime()<=now.getTime()+windowDays*86400000?'DUE_SOON':'VALID';
}
export function billingBuckets(rows:readonly AccountExpiry[],now=new Date()){
 return rows.reduce((totals,row)=>{
  const bucket=billingBucket(row,now);
  totals[bucket]++;
  return totals;
 },{VALID:0,DUE_SOON:0,EXPIRED:0,SUSPENDED:0} as Record<BillingBucket,number>);
}
