/** Read-only subscription state. Reporting never grants a grace period or changes access. */
export function subscriptionOverview(status:string, endsAt:Date|null, now:Date=new Date()){
 const expiresAt=endsAt?.toISOString()??null;
 const expired=endsAt!==null&&endsAt.getTime()<=now.getTime();
 const eligibleStatus=status==='ACTIVE'||status==='TRIAL';
 const active=eligibleStatus&&!expired&&endsAt!==null;
 const daysRemaining=endsAt===null?null:Math.max(0,Math.ceil((endsAt.getTime()-now.getTime())/86_400_000));
 return {status,expiresAt,expired,active,daysRemaining};
}
export function quotaOverview(used:number,limit:number|null){
 return {used,limit,remaining:limit===null?null:Math.max(0,limit-used),atLimit:limit!==null&&used>=limit};
}
