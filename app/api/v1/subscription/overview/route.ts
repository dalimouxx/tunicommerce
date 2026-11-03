import {prisma} from '../../../../../modules/storage/client';
import {getCurrentUser} from '../../../../../modules/auth/session';
import {respond} from '../../../../../modules/auth/http';
import {effectiveLimit} from '../../../../../modules/subscriptions/validation';
import {countMerchantShopSlots} from '../../../../../modules/shops/plan-limits';
import {countStaffSeats} from '../../../../../modules/shops/member-limits';
import {quotaOverview,subscriptionOverview} from '../../../../../modules/subscriptions/overview';

export const dynamic='force-dynamic';

/** Merchant-only, read-only overview. No credentials, billing evidence or member identities. */
export async function GET(){
 try{
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const workspace=await prisma.workspace.findUnique({
   where:{ownerId:user.userId},
   select:{plan:true,subscriptionStatus:true,subscriptionEndsAt:true,shop:{select:{id:true}}}
  });
  if(!workspace)return respond({error:'Aucun abonnement marchand configuré'},404);
  const [plan,shops,memberships]=await Promise.all([
   prisma.subscriptionPlan.findUnique({where:{code:workspace.plan},
    select:{code:true,name:true,enabled:true,maxShops:true,maxMembers:true}}),
   prisma.shop.count({where:{organization:{ownerId:user.userId}}}),
   prisma.membership.findMany({where:{active:true,shop:{organization:{ownerId:user.userId}}},
    select:{userId:true}})
  ]);
  if(!plan)return respond({error:'Offre introuvable'},404);
  const shopUsed=countMerchantShopSlots(shops,!workspace.shop);
  const memberUsed=countStaffSeats(memberships.map(m=>m.userId),user.userId);
  return respond({
   plan:{code:plan.code,name:plan.name,enabled:plan.enabled},
   subscription:subscriptionOverview(workspace.subscriptionStatus,workspace.subscriptionEndsAt),
   quotas:{
    shops:quotaOverview(shopUsed,effectiveLimit(plan.maxShops,undefined)),
    members:quotaOverview(memberUsed,effectiveLimit(plan.maxMembers,undefined))
   },
   notice:'Informations de consultation uniquement. Aucune prolongation automatique ni période de grâce accordée.'
  });
 }catch{
  return respond({error:'Vue abonnement temporairement indisponible'},503);
 }
}
