import {HttpError} from '../auth/http';
import {prisma} from '../storage/client';
import {effectiveLimit} from '../subscriptions/validation';

/** Every draft, paused or published shop consumes one slot. Linked legacy shops
 * count once; an unlinked historical Workspace also reserves a slot.
 */
export function countMerchantShopSlots(ownedShops:number,hasUnlinkedLegacy:boolean){
 return ownedShops+(hasUnlinkedLegacy?1:0);
}
export function assertShopSlotLimit(used:number,maximum:number|null){
 if(maximum!==null&&used>=maximum)
  throw new HttpError(409,`Limite de boutiques atteinte (${used}/${maximum}). Modifiez votre abonnement.`);
}
export type ShopSlotUsage={used:number;limit:number|null;plan:string};

/**
 * Must be invoked inside a transaction holding the owner's advisory lock.
 * Owners cannot bypass their plan by creating shops under a second organization.
 */
export async function shopSlotsForOwner(
 ownerId:string,
 tx:Pick<typeof prisma,'workspace'|'subscriptionPlan'|'shop'>
):Promise<ShopSlotUsage>{
 const workspace=await tx.workspace.findUnique({
  where:{ownerId},
  select:{id:true,plan:true,shop:{select:{id:true}}}
 });
 if(!workspace)throw new HttpError(409,'Un abonnement marchand doit être configuré avant la création de boutiques.');
 const [plan,ownedCount]=await Promise.all([
  tx.subscriptionPlan.findUnique({where:{code:workspace.plan},select:{maxShops:true,enabled:true}}),
  tx.shop.count({where:{organization:{ownerId}}})
 ]);
 if(!plan||!plan.enabled)throw new HttpError(409,'Offre marchand indisponible. Contactez l’administrateur.');
 return {
  used:countMerchantShopSlots(ownedCount,!workspace.shop),
  limit:effectiveLimit(plan.maxShops,undefined),
  plan:workspace.plan
 };
}
