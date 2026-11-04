'use client';
import {useState} from 'react';
import {merchantWorkspaceTabs,type MerchantWorkspaceTab} from '../../../modules/shops/workspace-tabs';
import ShopOrders from './shop-orders';
import ShopInventory from './shop-inventory';
import ShopWarehouses from './shop-warehouses';
import ShopCoupons from './shop-coupons';
import ShopCallCenterAlerts from './shop-callcenter-alerts';
import ShopAgentAssignment from './shop-agent-assignment';
import ShopConfirmationDesk from './shop-confirmation-desk';
import ShopCarrierConfig from './shop-carrier-config';
import ShopFulfillment from './shop-fulfillment';
import ShopCarrierHandoffs from './shop-carrier-handoffs';
import ShopExpenses from './shop-expenses';
import ShopCodSettlements from './shop-cod-settlements';
import ShopCarrierStatements from './shop-carrier-statements';
import ShopCodMatching from './shop-cod-matching';
import ShopReturns from './shop-returns';
import ShopCustomers from './shop-customers';
import ShopInsights from './shop-insights';
import ShopStorefrontThemes from './shop-storefront-themes';
import styles from '../shops.module.css';

/** The active workspace mounts only its own client modules, reducing simultaneous
 * requests and keeping the merchant dashboard usable on smaller screens.
 * Existing API authorization is unchanged.
 */
export default function MerchantShopWorkspace({shopId}:{shopId:string}){
 const [active,setActive]=useState<MerchantWorkspaceTab>('orders');
 const current=merchantWorkspaceTabs.find(tab=>tab.id===active)!;
 return <section aria-label="Espaces de gestion de ma boutique" className={styles.workspaceShell}>
  <header className={styles.workspaceHeader}>
   <h2>Gestion de ma boutique</h2>
   <p>Choisissez un espace de travail. Les autres boutiques et l'administration globale restent indépendantes.</p>
  </header>
  <nav aria-label="Modules de gestion" className={styles.workspaceNavigation}>
   {merchantWorkspaceTabs.map(tab=><button key={tab.id} type="button"
    aria-current={tab.id===active?'page':undefined}
    aria-label={tab.label}
    className={tab.id===active?styles.workspaceTabActive:styles.workspaceTab}
    onClick={()=>setActive(tab.id)}>
    {tab.label}
   </button>)}
  </nav>
  <div className={styles.workspacePanel}>
   <h3>{current.label}</h3>
   <p>{current.description}</p>
   {active==='orders'&&<ShopOrders shopId={shopId}/>}
   {active==='catalog'&&<><ShopInventory shopId={shopId}/><ShopWarehouses shopId={shopId}/><ShopCoupons shopId={shopId}/></>}
   {active==='callcenter'&&<><ShopCallCenterAlerts shopId={shopId}/><ShopAgentAssignment shopId={shopId}/><ShopConfirmationDesk shopId={shopId}/></>}
   {active==='delivery'&&<><ShopCarrierConfig shopId={shopId}/><ShopFulfillment shopId={shopId}/><ShopCarrierHandoffs shopId={shopId}/></>}
   {active==='finance'&&<><ShopExpenses shopId={shopId}/><ShopCodSettlements shopId={shopId}/><ShopCarrierStatements shopId={shopId}/><ShopCodMatching shopId={shopId}/><ShopReturns shopId={shopId}/></>}
   {active==='growth'&&<><ShopCustomers shopId={shopId}/><ShopInsights shopId={shopId}/><ShopStorefrontThemes shopId={shopId}/></>}
  </div>
 </section>;
}
