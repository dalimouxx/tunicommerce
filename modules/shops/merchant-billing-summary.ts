import type {State} from '../commerce/types';
import type {EnforcedQuotas} from '../subscriptions/quotas';
import {merchantQuotaUsage} from './billing-usage';
import {subscriptionOverview} from '../subscriptions/overview';

export function ownerCommerceBillingSummary(states:readonly State[],
 quotas:Pick<EnforcedQuotas,'maxProducts'|'maxOrdersPerMonth'>,
 subscription:{status:string;endsAt:Date|null},now=new Date()){
 const usage=merchantQuotaUsage(states,quotas,now);
 const access=subscriptionOverview(subscription.status,subscription.endsAt,now);
 let attention:string|null=null;
 if(!access.active)attention='Votre abonnement est expiré, suspendu ou sans échéance. Les nouvelles commandes et créations de produits sont restreintes.';
 else if(access.daysRemaining!==null&&access.daysRemaining<=7)
  attention='Votre abonnement arrive à échéance dans '+access.daysRemaining+' jour(s). Préparez le renouvellement depuis le formulaire ci-dessous.';
 return {...usage,subscription:access,attention};
}
