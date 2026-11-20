// Dependency-free so merchant and admin client screens can use it.
/** Why a historical shop is or is not visible to the public, for merchant and admin screens (same rule as isOpen). */
export function storefrontAvailability(shop:{published:boolean;subscriptionStatus:string;subscriptionEndsAt:Date|string|null},now=new Date()):{open:boolean;reason:null|'unpublished'|'subscription'}{
 const endsAt=shop.subscriptionEndsAt===null?null:new Date(shop.subscriptionEndsAt);
 const subscribed=['TRIAL','ACTIVE'].includes(shop.subscriptionStatus)&&!!endsAt&&endsAt>now;
 if(!shop.published)return {open:false,reason:'unpublished'};
 return subscribed?{open:true,reason:null}:{open:false,reason:'subscription'};
}
export const storefrontClosedLabels={unpublished:'Non publiée : les visiteurs voient une page « boutique indisponible ».',
 subscription:'Abonnement expiré ou suspendu : la boutique n’est plus visible par les visiteurs.'} as const;
