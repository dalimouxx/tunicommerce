'use client';
import {useState} from 'react';
import {Download, Headphones, Truck} from 'lucide-react';
import {labels, type Order, type State, type Status} from '../../modules/commerce/types';
import {OrderTable, exportCSV, orderCustomer} from './shared';
import {CarrierManifestDialog} from './carrier-manifest-dialog';

export const PAGE_SIZE = 10;

/** Status tabs offered by each order list. */
function tabsFor(page: string): string[] {
 if (page === 'Call Center') return ['Toutes', 'TO_CONFIRM', 'CALLBACK', 'NO_ANSWER'];
 if (page === 'Livraisons') return ['Toutes', 'READY', 'SHIPPED', 'DELIVERED'];
 if (page === 'Retours') return ['Toutes'];
 return ['Toutes', 'TO_CONFIRM', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
}

/** Orders matching the search, restricted to what each list shows. */
export function ordersForPage(page: string, matching: Order[], filter: string) {
 return matching.filter(o => (filter === 'Toutes' || o.status === filter) && (
  page === 'Call Center' ? ['TO_CONFIRM', 'CALLBACK', 'NO_ANSWER'].includes(o.status)
   : page === 'Livraisons' ? ['READY', 'SHIPPED', 'DELIVERED'].includes(o.status)
    : page === 'Retours' ? o.status === 'RETURNED'
     : true));
}

/** Commandes, Call Center and Livraisons share this paginated list. */
export function OrdersPage({state, page, matching, visibleOrders, filter, pageNo, setFilter, setPageNo, onSelect}: {
 state: State; page: string; matching: Order[]; visibleOrders: Order[]; filter: string; pageNo: number;
 setFilter: (filter: string) => void; setPageNo: (page: number) => void; onSelect: (id: string) => void;
}) {
 const exportOrders = () => exportCSV([
  ['Référence', 'Client', 'Téléphone', 'Gouvernorat', 'Statut', 'Total TND', 'COD reçu TND'],
  ...visibleOrders.map(o => {
   const c = orderCustomer(state, o);
   return [o.reference, c?.name, c?.phone, c?.city, labels[o.status], o.total / 1000, o.collected / 1000];
  }),
 ], 'commandes.csv');
 const pages = Math.max(1, Math.ceil(visibleOrders.length / PAGE_SIZE));
 const [manifest, setManifest] = useState(false);
 return <><div className="card">
  <div className="list-toolbar">
   <div className="tabs">
    {tabsFor(page).map(t => <button className={filter === t ? 'active' : ''} key={t} onClick={() => { setFilter(t); setPageNo(1); }}>
     {t === 'Toutes' ? 'Toutes' : labels[t as Status]} <span>{t === 'Toutes' ? matching.length : matching.filter(o => o.status === t).length}</span>
    </button>)}
   </div>
   <div style={{display: 'flex', gap: 8}}>
    {page === 'Livraisons' && <button className="button small-button" onClick={() => setManifest(true)}><Truck size={15}/>Bordereau transporteur</button>}
    <button className="button small-button" onClick={exportOrders}><Download size={15}/>CSV</button>
   </div>
  </div>
  {page === 'Call Center' && <div className="info-strip">
   <Headphones size={17}/> Ouvrez une commande pour appeler le client, confirmer ou programmer un rappel.
  </div>}
  {page === 'Retours' && <div className="info-strip">Les retours après livraison, échanges et remboursements seront ajoutés dans une phase suivante. Les refus de livraison sont suivis ici.</div>}
  <OrderTable state={state} orders={visibleOrders.slice((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE)} onSelect={onSelect}/>
  <div className="pagination">
   <span>{visibleOrders.length} commandes · Page {pageNo} sur {pages}</span>
   <div>
    <button className="button small-button" disabled={pageNo <= 1} onClick={() => setPageNo(pageNo - 1)}>Précédent</button>
    <button className="button small-button" disabled={pageNo * PAGE_SIZE >= visibleOrders.length} onClick={() => setPageNo(pageNo + 1)}>Suivant</button>
   </div>
  </div>
 </div>
 {manifest && <CarrierManifestDialog state={state} close={() => setManifest(false)}/>}</>;
}
