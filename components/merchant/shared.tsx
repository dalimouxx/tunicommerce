import {
 Activity, Boxes, ChartNoAxesCombined, ChevronRight, Headphones, LayoutDashboard, Package, Receipt,
 RotateCcw, Settings, ShoppingBag, Store, Ticket, Truck, Users, Wallet,
} from 'lucide-react';
import {labels, money, type Order, type State, type Status} from '../../modules/commerce/types';
import type {metrics} from '../../modules/commerce/service';

export type Metrics = ReturnType<typeof metrics>;
export type Act = (action: string, payload: unknown) => Promise<boolean>;

/** Sidebar sections of the merchant workspace; `group` starts a new heading.
 * Automations and integrations come back here once real providers are connected (bloc C). */
export const nav = [
 {label: 'Vue d’ensemble', icon: LayoutDashboard, group: 'PILOTAGE'},
 {label: 'Commandes', icon: ShoppingBag},
 {label: 'Call Center', icon: Headphones},
 {label: 'Produits', icon: Package, group: 'COMMERCE'},
 {label: 'Inventaire', icon: Boxes},
 {label: 'Clients', icon: Users},
 {label: 'Livraisons', icon: Truck},
 {label: 'Transporteurs & zones', icon: Truck},
 {label: 'Retours', icon: RotateCcw},
 {label: 'Finances & COD', icon: Wallet, group: 'CROISSANCE'},
 {label: 'Factures', icon: Receipt},
 {label: 'Analyses', icon: ChartNoAxesCombined},
 {label: 'Coupons', icon: Ticket},
 {label: 'Ma boutique', icon: Store, group: 'ESPACE BOUTIQUE'},
 {label: 'Paniers', icon: ShoppingBag},
 {label: 'Activité', icon: Activity},
 {label: 'Paramètres', icon: Settings},
];

export const dt = (d: string) => new Date(d).toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'});

/** Customer as it was when the order was placed, falling back to the current record. */
export const orderCustomer = (state: State, order: Order) =>
 order.customerSnapshot || state.customers.find(c => c.id === order.customerId)!;

export function Badge({status}: {status: Status}) {
 return <span className={'badge ' + status.toLowerCase()}><i/>{labels[status]}</span>;
}

/** Spreadsheet-safe CSV (formula prefixes neutralised), downloaded in the browser. */
export function exportCSV(rows: unknown[][], filename: string) {
 const cell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
 const csv = '﻿' + rows.map(row => row.map(cell).join(';')).join('\r\n');
 const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 a.click();
 URL.revokeObjectURL(url);
}

const sourceIcon = (source: string) =>
 source === 'Facebook' ? 'f' : source === 'Instagram' ? '◎' : source === 'WhatsApp' ? '◉' : source === 'TikTok' ? '♪' : '▣';

export function OrderTable({state, orders, compact = false, onSelect}: {
 state: State; orders: Order[]; compact?: boolean; onSelect: (id: string) => void;
}) {
 return <div className="table-scroll">
  <table>
   <thead>
    <tr>
     <th>Commande</th><th>Client</th>{!compact && <th>Produits</th>}<th>Statut</th><th>Montant</th><th>Source</th><th></th>
    </tr>
   </thead>
   <tbody>
    {orders.map(o => {
     const customer = orderCustomer(state, o);
     return <tr key={o.id} onClick={() => onSelect(o.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onSelect(o.id); }}>
      <td><strong className="order-ref">#{o.reference}</strong><small>{dt(o.createdAt)}</small></td>
      <td>
       <div className="customer-cell">
        <span className={'avatar tint' + o.customerId.charCodeAt(o.customerId.length - 1) % 4}>
         {customer?.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
        </span>
        <div><strong>{customer?.name}</strong><small>{customer?.city}</small></div>
       </div>
      </td>
      {!compact && <td>{o.items[0].name}<small>{o.items.reduce((s, i) => s + i.quantity, 0)} article(s)</small></td>}
      <td><Badge status={o.status}/></td>
      <td><strong>{money(o.total)}</strong><span className="currency"> TND</span></td>
      <td><span className={'source ' + o.source.toLowerCase()}>{sourceIcon(o.source)}</span> {o.source}</td>
      <td><ChevronRight size={15}/></td>
     </tr>;
    })}
   </tbody>
  </table>
  {!orders.length && <div className="empty">
   <ShoppingBag/>
   <h3>Aucune commande ici</h3>
   <p>Modifiez les filtres ou créez votre première commande.</p>
  </div>}
 </div>;
}
