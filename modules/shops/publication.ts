import {subscriptionOverview} from '../subscriptions/overview';

export function canPublishIsolatedShop(input:{
 legacyWorkspaceId:string|null;
 memberActive:boolean;
 memberRole:string;
 initialized:boolean;
 activeProducts:number;
 subscriptionStatus:string;
 subscriptionEndsAt:Date|null;
},now=new Date()){
 return input.legacyWorkspaceId===null&&input.memberActive&&input.memberRole==='OWNER'&&
  input.initialized&&input.activeProducts>0&&
  subscriptionOverview(input.subscriptionStatus,input.subscriptionEndsAt,now).active;
}

/** Public access requires explicit publication AND an independently valid merchant subscription. */
export function isPublicIsolatedShop(input:{
 status:string;legacyWorkspaceId:string|null;initialized:boolean;
 subscriptionStatus:string;subscriptionEndsAt:Date|null;
},now=new Date()){
 return input.status==='PUBLISHED'&&input.legacyWorkspaceId===null&&input.initialized&&
  subscriptionOverview(input.subscriptionStatus,input.subscriptionEndsAt,now).active;
}
