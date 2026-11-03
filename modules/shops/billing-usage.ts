import type {State} from '../commerce/types';
import {merchantUsage} from './aggregate-quotas';
import {quotaOverview} from '../subscriptions/overview';
import type {EnforcedQuotas} from '../subscriptions/quotas';

export function merchantQuotaUsage(states:readonly State[],quotas:Pick<EnforcedQuotas,'maxProducts'|'maxOrdersPerMonth'>,now=new Date()){
 const totals=merchantUsage(states,now);
 const products=quotaOverview(totals.products,quotas.maxProducts);
 const orders=quotaOverview(totals.ordersThisMonth,quotas.maxOrdersPerMonth);
 return {
  products:{...products,nearLimit:products.limit!==null&&products.used>=Math.ceil(products.limit*0.8)},
  orders:{...orders,nearLimit:orders.limit!==null&&orders.used>=Math.ceil(orders.limit*0.8)}
 };
}
