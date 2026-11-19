'use client';
import {useState, useEffect, useMemo, useRef} from 'react';
import {CheckCircle2, X} from 'lucide-react';
import {initialState} from '../modules/commerce/seed';
import type {State, Product, Status} from '../modules/commerce/types';
import {metrics} from '../modules/commerce/service';
import {Dashboard} from './dashboard';
import {ReturnsPage} from './returns';
import {InvoicesPage} from './invoices';
import {Storefront, CartsPage} from './storefront';
import {DeliverySettings, ShipmentCostForm} from './delivery';
import {Modal, OrderForm, ProductForm, SimpleForm} from './forms';
import {OrderTable, orderCustomer, type Act} from './merchant/shared';
import {ContextBar, NotificationPanel, PageHeading, Sidebar, Topbar} from './merchant/shell';
import {OrdersPage, ordersForPage} from './merchant/orders-page';
import {CustomersPage, InventoryPage, ProductsPage} from './merchant/catalog-pages';
import {AnalyticsPage, FinancesPage} from './merchant/report-pages';
import {ActivityPage, AutomationsPage, CouponsPage, IntegrationsPage, SettingsPage} from './merchant/simple-pages';
import {OrderDrawer} from './merchant/order-drawer';
import {HelpGuide, LanguageNotice, ResetForm, TransitionForm, modalTitles} from './merchant/dialogs';

const OVERVIEW = 'Vue d’ensemble';
const ORDER_LISTS = ['Commandes', 'Call Center', 'Livraisons'];
const SIMPLE_FORMS = ['stock', 'expense', 'settlement', 'coupon', 'settings'];

/** Private merchant workspace of the historical shop: one client state, saved through /api/commerce. */
export default function App({shopSlug}: {shopSlug?: string | null}) {
 const pendingRequests = useRef(new Map<string, string>());
 const [state, setState] = useState<State>(() => initialState(false));
 const [connected, setConnected] = useState(false);
 const [loading, setLoading] = useState(true);
 const [page, setPage] = useState(OVERVIEW);
 const [search, setSearch] = useState('');
 const [filter, setFilter] = useState('Toutes');
 const [period, setPeriod] = useState('30');
 const [modal, setModal] = useState('');
 const [selected, setSelected] = useState<string | null>(null);
 const [editProduct, setEditProduct] = useState<Product | undefined>();
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');
 const [notice, setNotice] = useState(false);
 const [menu, setMenu] = useState(false);
 const [pageNo, setPageNo] = useState(1);
 const [confirmStatus, setConfirmStatus] = useState<Status | null>(null);

 async function refresh() {
  setLoading(true);
  try {
   const r = await fetch('/api/commerce');
   if (r.ok) {
    const data = await r.json() as {state: State; error?: string};
    setState(data.state);
    setConnected(true);
   } else {
    setState(initialState(false));
    setConnected(false);
   }
  } catch {
   setState(initialState(false));
   setConnected(false);
  }
  setLoading(false);
 }
 useEffect(() => { refresh(); }, []);
 useEffect(() => {
  if (message) {
   const timer = setTimeout(() => setMessage(''), 5000);
   return () => clearTimeout(timer);
  }
 }, [message]);
 // Ctrl/Cmd+K focuses the search; Escape closes every overlay.
 useEffect(() => {
  const fn = (e: KeyboardEvent) => {
   if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('global-search')?.focus();
   }
   if (e.key === 'Escape') {
    setModal('');
    setSelected(null);
    setNotice(false);
   }
  };
  window.addEventListener('keydown', fn);
  return () => window.removeEventListener('keydown', fn);
 }, []);

 const go = (p: string) => { setPage(p); setSearch(''); setFilter('Toutes'); setPageNo(1); setMenu(false); };

 /** Sends one action; a retried identical action reuses its request id so the server applies it once. */
 const act: Act = async (action, payload) => {
  if (!connected) {
   setMessage('Connectez-vous pour enregistrer vos modifications.');
   return false;
  }
  setBusy(true);
  const requestKey = JSON.stringify({action, payload});
  const requestId = pendingRequests.current.get(requestKey) || crypto.randomUUID();
  pendingRequests.current.set(requestKey, requestId);
  try {
   const r = await fetch('/api/commerce', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action, payload, requestId}),
   });
   const data = await r.json() as {state: State; error?: string};
   if (!r.ok) {
    if (r.status === 401 || r.status === 403) {
     setState(initialState(false));
     setConnected(false);
    }
    pendingRequests.current.delete(requestKey);
    throw Error(data.error || 'Erreur serveur');
   }
   pendingRequests.current.delete(requestKey);
   setState(data.state);
   setModal('');
   setConfirmStatus(null);
   setMessage('Modification enregistrée');
   return true;
  } catch (e) {
   setMessage(e instanceof Error ? e.message : 'Erreur réseau');
   return false;
  } finally {
   setBusy(false);
  }
 };

 const selectedOrder = state.orders.find(o => o.id === selected);
 const cutoff = Date.now() - Number(period) * 86400000;
 const periodOrders = state.orders.filter(o => Date.parse(o.createdAt) >= cutoff);
 const periodState = {...state, expenses: state.expenses.filter(e => Date.parse(e.date) >= cutoff)};
 const m = metrics(periodState, periodOrders);
 const low = state.products.filter(p => p.stock <= p.threshold);
 const needle = search.toLowerCase();
 const matching = state.orders.filter(o => {
  const c = orderCustomer(state, o);
  return [o.reference, c?.name, c?.phone, o.tracking, ...o.items.map(i => i.name)].join(' ').toLowerCase().includes(needle);
 });
 const visibleOrders = ordersForPage(page, matching, filter);
 const productList = state.products.filter(p => [p.name, p.sku, p.variant].join(' ').toLowerCase().includes(needle));
 const chart = useMemo(() => Array.from({length: 14}, (_, i) => {
  const day = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
  return {day, value: state.orders.filter(o => o.createdAt.startsWith(day) && o.status === 'DELIVERED').reduce((s, o) => s + o.total, 0)};
 }), [state]);
 const max = Math.max(...chart.map(c => c.value), 100000);
 const points = chart.map((c, i) => `${i * 48},${165 - c.value / max * 135}`).join(' ');
 const orderTable = (orders: typeof state.orders, compact = false) =>
  <OrderTable state={state} orders={orders} compact={compact} onSelect={setSelected}/>;
 const topProducts = state.products.map(p => ({
  ...p,
  units: periodOrders.filter(o => o.status === 'DELIVERED')
   .reduce((n, o) => n + o.items.filter(i => i.productId === p.id).reduce((n, i) => n + i.quantity, 0), 0),
 })).sort((a, b) => b.units - a.units);
 const newProduct = () => { setEditProduct(undefined); setModal('product'); };
 const headerActions: Record<string, () => void> = {
  'Commandes': () => setModal('order'),
  'Call Center': () => setModal('order'),
  'Produits': newProduct,
  'Inventaire': () => setModal('stock'),
  'Finances & COD': () => setModal('settlement'),
  'Coupons': () => setModal('coupon'),
 };
 const pendingRequestOrders = state.orders.filter(o => o.customerRequests?.some(r => r.status === 'PENDING'));

 if (loading || !connected) return <main className="platform">
  <section className="card" style={{maxWidth: 620, margin: '12vh auto', padding: 32}} aria-busy={loading}>
   <span className="eyebrow">ESPACE PRIVÉ MARCHAND</span>
   <h1>{loading ? 'Chargement de votre boutique…' : 'Votre espace est indisponible'}</h1>
   <p role="status">{loading ? 'Vérification de votre session et récupération de vos données.' : 'Vérifiez votre connexion ou reconnectez-vous. Aucune donnée de démonstration ne remplace votre boutique.'}</p>
   {!loading && <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
    <button className="primary" onClick={() => void refresh()}>Réessayer</button>
    <a className="button" href="/connexion/boutique">Se reconnecter</a>
   </div>}
  </section>
 </main>;

 return <div className="app-shell">
  <Sidebar state={state} page={page} m={m} menu={menu} shopSlug={shopSlug} go={go} openModal={setModal}/>
  <div className="main-shell">
   <Topbar page={page} search={search} menu={menu} notice={notice} setMenu={setMenu} setNotice={setNotice} openModal={setModal}
    onSearch={value => { setSearch(value); if (page === OVERVIEW) setPage('Commandes'); setPageNo(1); }}/>
   {notice && <NotificationPanel m={m} lowCount={low.length} open={target => { go(target); setNotice(false); }}/>}
   <main>
    {pendingRequestOrders.length > 0 && <div className="notice">
     <strong>Demandes clients à traiter</strong>
     {pendingRequestOrders.map(o => <button key={o.id} className="button" onClick={() => setSelected(o.id)}>{o.reference} · Ouvrir la demande</button>)}
    </div>}
    <PageHeading page={page} m={m} headerAction={headerActions[page]} openModal={setModal} refresh={refresh}/>
    <ContextBar state={state} connected={connected} loading={loading} period={period} setPeriod={setPeriod}/>
    {page === OVERVIEW && <Dashboard {...{state, periodOrders, m, chart, max, points, low, go, orderTable, topProducts}}/>}
    {ORDER_LISTS.includes(page) && <OrdersPage state={state} page={page} matching={matching} visibleOrders={visibleOrders}
     filter={filter} pageNo={pageNo} setFilter={setFilter} setPageNo={setPageNo} onSelect={setSelected}/>}
    {page === 'Produits' && <ProductsPage state={state} products={productList} lowCount={low.length}
     onEdit={p => { setEditProduct(p); setModal('product'); }}/>}
    {page === 'Inventaire' && <InventoryPage state={state} products={productList} lowCount={low.length}/>}
    {page === 'Clients' && <CustomersPage state={state} search={search}/>}
    {page === 'Finances & COD' && <FinancesPage state={state} m={m} periodOrders={periodOrders} onSelect={setSelected} addExpense={() => setModal('expense')}/>}
    {page === 'Analyses' && <AnalyticsPage state={state} m={m} periodOrders={periodOrders} topProducts={topProducts}/>}
    {page === 'Coupons' && <CouponsPage state={state}/>}
    {page === 'Ma boutique' && <Storefront {...{state, act, busy, connected}}/>}
    {page === 'Transporteurs & zones' && <DeliverySettings {...{state, act, busy}}/>}
    {page === 'Paniers' && <CartsPage state={state}/>}
    {page === 'Retours' && <ReturnsPage state={state} act={act} busy={busy} selectOrder={setSelected}/>}
    {page === 'Factures' && <InvoicesPage {...{state, act, busy}}/>}
    {page === 'Intégrations' && <IntegrationsPage/>}
    {page === 'Automatisations' && <AutomationsPage/>}
    {page === 'Activité' && <ActivityPage state={state}/>}
    {page === 'Paramètres' && <SettingsPage state={state} act={act} busy={busy}
     onLogoutError={() => setMessage('Déconnexion impossible. Réessayez.')} askReset={() => setModal('reset')}/>}
    <footer>
     <span><span className="footer-dot"/>Tunicom <span className="muted">· Pensé pour votre commerce.</span></span>
     <span>Tunisie <span className="footer-flag">🇹🇳</span> <span className="muted">TND</span></span>
    </footer>
   </main>
  </div>
  {selectedOrder && <OrderDrawer state={state} order={selectedOrder} act={act} busy={busy} close={() => setSelected(null)}
   openModal={setModal} askTransition={status => { setConfirmStatus(status); setModal('transition'); }}/>}
  {modal && <Modal title={(modal === 'product' ? (editProduct ? 'Modifier le produit' : 'Ajouter un produit') : modalTitles[modal]) || modal} close={() => setModal('')}>
   {modal === 'shipmentCost' && selectedOrder && <ShipmentCostForm order={selectedOrder} submit={p => act('shipmentCost', p)} busy={busy}/>}
   {modal === 'order' && <OrderForm state={state} submit={p => act('createOrder', p)} busy={busy}/>}
   {modal === 'product' && <ProductForm product={editProduct} submit={p => act('product', p)} busy={busy}/>}
   {SIMPLE_FORMS.includes(modal) && <SimpleForm kind={modal} state={state} order={selectedOrder} submit={p => act(modal, p)} busy={busy}/>}
   {modal === 'transition' && selectedOrder && confirmStatus && <TransitionForm state={state} order={selectedOrder} status={confirmStatus} act={act} busy={busy}/>}
   {modal === 'reset' && <ResetForm act={act} busy={busy} onDone={() => setSelected(null)}/>}
   {modal === 'help' && <HelpGuide/>}
   {modal === 'language' && <LanguageNotice/>}
  </Modal>}
  {message && <div className="toast" role="status">
   <CheckCircle2 size={18}/>{message}
   <button className="icon-button" onClick={() => setMessage('')} aria-label="Fermer"><X size={14}/></button>
  </div>}
 </div>;
}
