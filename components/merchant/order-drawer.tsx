import {ArrowRight, Clock, Phone, Plus, Truck, Wallet, X} from 'lucide-react';
import {labels, money, transitions, type Order, type State, type Status} from '../../modules/commerce/types';
import {CustomerInsights} from '../customer-insights';
import {CustomerRequests} from '../customer-requests';
import {CustomerMessage} from './customer-message';
import {ProductArt} from '../product-art';
import {Badge, orderCustomer, type Act} from './shared';

/** Side panel with one order: customer, items, totals, next steps, history and internal notes. */
export function OrderDrawer({state, order, act, busy, close, openModal, askTransition, openMessages}: {
 state: State; order: Order; act: Act; busy: boolean; close: () => void;
 openModal: (modal: string) => void; askTransition: (status: Status) => void; openMessages: () => void;
}) {
 const customer = orderCustomer(state, order);
 const product = (id: string) => state.products.find(p => p.id === id);
 const totals: [string, number][] = [
  ['Sous-total', order.subtotal],
  ['Réduction', -order.discount],
  ['Livraison', order.shipping],
  ['Total', order.total],
  ['COD encaissé', order.collected],
 ];
 const next = transitions[order.status];
 return <div className="drawer-backdrop" onClick={close}>
  <section className="drawer" role="dialog" aria-modal="true" aria-label="Détail commande" onClick={e => e.stopPropagation()}>
   <header>
    <div><span className="eyebrow">DÉTAIL DE COMMANDE</span><h2>#{order.reference}</h2></div>
    <button className="icon-button" onClick={close} aria-label="Fermer"><X size={21}/></button>
   </header>
   <div className="drawer-body">
    <Badge status={order.status}/>
    <div className="detail-customer">
     <span className="avatar tint1">{customer?.name[0]}</span>
     <div>
      <h3>{customer?.name}</h3>
      <p>{customer?.city} · {customer?.address}</p>
      <a className="text-button" href={'tel:+216' + customer?.phone}><Phone size={14}/>+216 {customer?.phone}</a>
     </div>
    </div>
    <CustomerInsights state={state} order={order}/>
    <CustomerMessage state={state} order={order} act={act} openSettings={openMessages}/>
    <CustomerRequests order={order} act={act} busy={busy}/>
    <h3 className="detail-title">Articles</h3>
    {order.items.map((item, index) => <div className="order-item" key={index}>
     <ProductArt category={product(item.productId)?.category || 'Autre'} color={product(item.productId)?.color}/>
     <div><strong>{item.name}</strong><small>{item.variant} · Qté {item.quantity}</small></div>
     <strong>{money(item.price * item.quantity)} DT</strong>
    </div>)}
    <div className="detail-totals">
     {totals.map(([label, value]) => <div key={label}><span>{label}</span><strong>{money(value)} TND</strong></div>)}
    </div>
    {order.tracking && <div className="info-strip"><Truck size={17}/>{order.carrier} · {order.tracking}</div>}
    {order.callbackAt && order.status === 'CALLBACK' && <div className="info-strip">
     <Clock size={17}/>Rappel : {new Date(order.callbackAt).toLocaleString('fr-FR')}
    </div>}
    <h3 className="detail-title">Prochaine étape</h3>
    {['SHIPPED', 'DELIVERED', 'RETURNED'].includes(order.status) &&
     <button className="text-button" onClick={() => openModal('shipmentCost')}>Corriger les frais de transport</button>}
    <div className="action-grid">
     {next.map(status => <button className={status === 'CANCELLED' || status === 'RETURNED' ? 'button danger-text' : 'button'} disabled={busy} key={status} onClick={() => askTransition(status)}>
      {labels[status]}<ArrowRight size={13}/>
     </button>)}
     {order.status === 'DELIVERED' && order.collected < order.total &&
      <button className="primary" onClick={() => openModal('settlement')}><Wallet size={15}/>Enregistrer un versement</button>}
    </div>
    {!next.length && <p className="muted small">Cette commande a terminé son parcours opérationnel.</p>}
    <h3 className="detail-title">Historique</h3>
    {order.compactedAt && <p className="muted" style={{fontSize: 12}}>Commande terminée depuis plus de 90 jours : historique détaillé archivé (export CSV « événements » disponible pour le propriétaire).</p>}
    <div className="timeline">
     {order.events.map((e, i) => <div key={i}><span className="timeline-dot"/><strong>{e.label}</strong><small>{new Date(e.at).toLocaleString('fr-FR')}</small></div>)}
    </div>
    <form className="note-form" onSubmit={e => {
     e.preventDefault();
     const form = e.currentTarget;
     act('note', {id: order.id, note: new FormData(form).get('note')}).then(ok => { if (ok) form.reset(); });
    }}>
     <input name="note" placeholder="Ajouter une note interne…" required/>
     <button className="icon-button" disabled={busy} aria-label="Ajouter la note"><Plus size={19}/></button>
    </form>
   </div>
  </section>
 </div>;
}
