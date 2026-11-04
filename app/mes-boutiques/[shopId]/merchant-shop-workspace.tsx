'use client';
import {useEffect,useState} from 'react';
import {merchantWorkspaceTabs,merchantWorkspaceHash,parseMerchantWorkspaceHash,type MerchantWorkspaceTab} from '../../../modules/shops/workspace-tabs';
import ShopOrders from './shop-orders';
import ShopInventory from './shop-inventory';
import ShopWarehouses from './shop-warehouses';
import ShopCoupons from './shop-coupons';
import ShopCallCenterAlerts from './shop-callcenter-alerts';
import ShopAgentAssignment from './shop-agent-assignment';
import ShopConfirmationDesk from './shop-confirmation-desk';
import ShopCustomerRequests from './shop-customer-requests';
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
 useEffect(()=>{
  const sync=()=>setActive(parseMerchantWorkspaceHash(window.location.hash)||'orders');
  sync();window.addEventListener('hashchange',sync);
  return()=>window.removeEventListener('hashchange',sync);
 },[]);
 function selectWorkspace(tab:MerchantWorkspaceTab){
  setActive(tab);
  window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search+merchantWorkspaceHash(tab));
 }
 return <section aria-label="Espaces de gestion de ma boutique" className={styles.workspaceShell}>
  <header className={styles.workspaceHeader}>
   <h2>Gestion de ma boutique</h2>
   <p>Choisissez un espace de travail. Les autres boutiques et l'administration globale restent indépendantes.</p>
  </header>
  <ShopCallCenterAlerts shopId={shopId}/>
  <nav role="tablist" aria-label="Modules de gestion" className={styles.workspaceNavigation}>
   {merchantWorkspaceTabs.map(tab=><button key={tab.id} type="button" role="tab"
    id={'espace-'+tab.id}
    aria-controls="contenu-espace-marchand"
    aria-selected={tab.id===active}
    aria-label={tab.label}
    className={tab.id===active?styles.workspaceTabActive:styles.workspaceTab}
    onClick={()=>selectWorkspace(tab.id)}>
    {tab.label}
   </button>)}
  </nav>
  <div id="contenu-espace-marchand" role="tabpanel" aria-labelledby={"espace-"+active} className={styles.workspacePanel}>
   <h3>{current.label}</h3>
   <p>{current.description} <a className={styles.workspaceDeepLink} href={merchantWorkspaceHash(active)}>Lien direct vers cet espace</a></p>
   {active==='orders'&&<ShopOrders shopId={shopId}/>}
   {active==='catalog'&&<><ShopInventory shopId={shopId}/><ShopWarehouses shopId={shopId}/><ShopCoupons shopId={shopId}/></>}
   {active==='callcenter'&&<><ShopAgentAssignment shopId={shopId}/><ShopConfirmationDesk shopId={shopId}/><ShopCustomerRequests shopId={shopId}/></>}
   {active==='delivery'&&<><ShopCarrierConfig shopId={shopId}/><ShopFulfillment shopId={shopId}/><ShopCarrierHandoffs shopId={shopId}/></>}
   {active==='finance'&&<><ShopExpenses shopId={shopId}/><ShopCodSettlements shopId={shopId}/><ShopCarrierStatements shopId={shopId}/><ShopCodMatching shopId={shopId}/><ShopReturns shopId={shopId}/></>}
   {active==='growth'&&<><ShopCustomers shopId={shopId}/><ShopInsights shopId={shopId}/><ShopStorefrontThemes shopId={shopId}/></>}
  </div>
 </section>;
}
