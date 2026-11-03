import {HttpError} from '../auth/http';
import {prisma} from '../storage/client';
import {effectiveLimit} from '../subscriptions/validation';

type MemberDb=Pick<typeof prisma,'membership'|'workspace'|'subscriptionPlan'|'user'>;

/** One person with access to multiple shops consumes one staff seat, not one seat per shop.
 * Organization owner is not a paid staff seat. Inactive members are excluded.
 */
export function countStaffSeats(userIds:readonly string[],ownerId:string):number{
 return new Set(userIds.filter(userId=>userId!==ownerId)).size;
}
export function assertStaffSeatLimit(used:number,limit:number|null){
 if(limit!==null&&used>=limit)
  throw new HttpError(409,`Limite de collaborateurs atteinte (${used}/${limit}). Modifiez votre abonnement.`);
}
export async function ownerForShop(shopId:string,tx:Pick<typeof prisma,'shop'>){
 const shop=await tx.shop.findUnique({where:{id:shopId},select:{organization:{select:{ownerId:true}}}});
 if(!shop)throw new HttpError(404,'Boutique introuvable');
 return shop.organization.ownerId;
}

/** Caller must hold the PostgreSQL per-owner advisory transaction lock for activation. */
export async function staffSeatsForOwner(ownerId:string,tx:MemberDb){
 const workspace=await tx.workspace.findUnique({where:{ownerId},select:{plan:true}});
 if(!workspace){
  // Preserve the historic bootstrap ADMIN setup, which has no Workspace until onboarding.
  const user=await tx.user.findUnique({where:{id:ownerId},select:{role:true}});
  if(user?.role!=='ADMIN')throw new HttpError(409,'Abonnement marchand manquant');
  return {used:0,limit:null,plan:'PLATFORM_ADMIN_BOOTSTRAP'};
 }
 const plan=await tx.subscriptionPlan.findUnique({
  where:{code:workspace.plan},select:{maxMembers:true,enabled:true}
 });
 if(!plan?.enabled)throw new HttpError(409,'Offre marchand indisponible');
 const memberships=await tx.membership.findMany({
  where:{active:true,shop:{organization:{ownerId}}},
  select:{userId:true}
 });
 return {
  used:countStaffSeats(memberships.map(m=>m.userId),ownerId),
  limit:effectiveLimit(plan.maxMembers,undefined),
  plan:workspace.plan
 };
}
/** No additional seat is needed if the invitee is already active in another owned shop. */
export async function assertCanActivateStaff(ownerId:string,userId:string,tx:MemberDb){
 if(ownerId===userId)return;
 const existing=await tx.membership.count({
  where:{userId,active:true,shop:{organization:{ownerId}}}
 });
 if(existing>0)return;
 const usage=await staffSeatsForOwner(ownerId,tx);
 assertStaffSeatLimit(usage.used,usage.limit);
}
