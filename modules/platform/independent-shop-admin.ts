export type IndependentShopAdminEntry={
 id:string;name:string;slug:string;status:string;
 initialized:boolean;organization:string;owner:string;email:string;
 plan:string|null;subscriptionStatus:string|null;subscriptionEndsAt:Date|null;
};
export function independentShopAdminSummary(rows:readonly IndependentShopAdminEntry[],now=new Date()){
 const activeSubscription=(s:IndependentShopAdminEntry)=>
  ['ACTIVE','TRIAL'].includes(s.subscriptionStatus||'')&&
  !!s.subscriptionEndsAt&&s.subscriptionEndsAt.getTime()>now.getTime();
 return {
  total:rows.length,
  published:rows.filter(row=>row.status==='PUBLISHED').length,
  publiclyAccessible:rows.filter(row=>row.status==='PUBLISHED'&&row.initialized&&activeSubscription(row)).length,
  draft:rows.filter(row=>row.status==='DRAFT').length,
  missingCommerce:rows.filter(row=>!row.initialized).length,
  inactiveSubscription:rows.filter(row=>!activeSubscription(row)).length
 };
}
export function independentShopPublicAccess(row:IndependentShopAdminEntry,now=new Date()){
 return row.status==='PUBLISHED'&&row.initialized&&
  ['ACTIVE','TRIAL'].includes(row.subscriptionStatus||'')&&
  !!row.subscriptionEndsAt&&row.subscriptionEndsAt.getTime()>now.getTime();
}
