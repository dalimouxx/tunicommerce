import type {State} from '../commerce/types';
import {metrics} from '../commerce/service';

/** Read-only per-shop financial indicators. Amounts are integer millimes.
 * Profit is an estimate until all carrier costs, credits and expenses are reconciled.
 */
export function isolatedShopFinanceOverview(state:State){
 const figures=metrics(state);
 return {
  deliveredGrossMillimes:figures.grossRevenue,
  creditsMillimes:figures.credits,
  deliveredNetMillimes:figures.revenue,
  collectedCodMillimes:figures.collected,
  outstandingCodMillimes:figures.pending,
  costOfGoodsMillimes:figures.cogs,
  estimatedDeliveryCostMillimes:figures.delivery,
  recordedExpensesMillimes:figures.expenses,
  estimatedOperatingMarginMillimes:figures.profit,
  refundsRecordedMillimes:figures.refunds,
  refundsRemainingMillimes:figures.refundDue,
  deliveredOrders:figures.delivered,
  returnedOrders:figures.returned
 };
}
