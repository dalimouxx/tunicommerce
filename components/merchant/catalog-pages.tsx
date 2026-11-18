import {Boxes, Download, Package, Wallet} from 'lucide-react';
import {money, type Product, type State} from '../../modules/commerce/types';
import {customerTrust} from '../../modules/customers/insights';
import {ProductArt} from '../product-art';
import {Stat} from '../stat';
import {dt, exportCSV} from './shared';

const totalStock = (state: State) => state.products.reduce((n, p) => n + p.stock, 0);
const isLow = (p: Product) => p.stock <= p.threshold;

export function ProductsPage({state, products, lowCount, onEdit}: {
 state: State; products: Product[]; lowCount: number; onEdit: (product: Product) => void;
}) {
 return <>
  <div className="section-summary">
   <span><strong>{state.products.length}</strong> références au catalogue</span>
   <span><strong>{totalStock(state)}</strong> unités disponibles</span>
   <span><strong>{lowCount}</strong> alertes stock</span>
  </div>
  <div className="product-grid">
   {products.map(p => <button className="product-card card" key={p.id} onClick={() => onEdit(p)}>
    <div className="product-image">
     {p.imageUrl
      ? <img src={p.imageUrl} alt={p.name} loading="lazy" style={{width: 155, height: 155, objectFit: 'contain', borderRadius: 9, background: '#f0f5f2'}}/>
      : <ProductArt category={p.category} color={p.color} size={155}/>}
     <span className={'stock-pill ' + (isLow(p) ? 'low' : '')}>{isLow(p) ? 'Stock faible' : 'En stock'}</span>
    </div>
    <div className="product-content">
     <span className="eyebrow">{p.category} · {p.sku}</span>
     <h3>{p.name}</h3>
     <p>{p.variant}</p>
     <div><strong>{money(p.price)} <small>TND</small></strong><span>{p.stock} disponibles</span></div>
    </div>
   </button>)}
  </div>
 </>;
}

export function InventoryPage({state, products, lowCount}: {state: State; products: Product[]; lowCount: number}) {
 return <>
  <div className="stats-grid three">
   <Stat title="Stock disponible" value={String(totalStock(state))} foot="Unités non réservées" icon={<Boxes size={18}/>} color="green"/>
   <Stat title="Valeur au coût d’achat" value={money(state.products.reduce((n, p) => n + p.stock * p.cost, 0))} suffix="TND" foot="Stock disponible uniquement" icon={<Wallet size={18}/>} color="blue"/>
   <Stat title="Sous le seuil d’alerte" value={String(lowCount)} foot="Produits à réapprovisionner" icon={<Package size={18}/>} color="orange"/>
  </div>
  <div className="card">
   <div className="card-heading"><h2>État des stocks</h2><span className="muted">Dépôt principal</span></div>
   <div className="table-scroll">
    <table>
     <thead><tr><th>Produit</th><th>SKU</th><th>Disponible</th><th>Seuil</th><th>État</th></tr></thead>
     <tbody>
      {products.map(p => <tr key={p.id}>
       <td><div className="customer-cell"><ProductArt category={p.category} color={p.color}/><div><strong>{p.name}</strong><small>{p.variant}</small></div></div></td>
       <td>{p.sku}</td>
       <td><strong>{p.stock}</strong></td>
       <td>{p.threshold}</td>
       <td><span className={'badge ' + (isLow(p) ? 'to_confirm' : 'delivered')}>{isLow(p) ? 'À réapprovisionner' : 'Disponible'}</span></td>
      </tr>)}
     </tbody>
    </table>
   </div>
  </div>
  <div className="card spaced">
   <div className="card-heading"><h2>Historique des mouvements</h2></div>
   <div className="table-scroll">
    <table>
     <thead><tr><th>Date</th><th>Produit</th><th>Motif</th><th>Quantité</th></tr></thead>
     <tbody>
      {state.movements.slice(0, 30).map(x => <tr key={x.id}>
       <td>{dt(x.at)}</td>
       <td>{state.products.find(p => p.id === x.productId)?.name}</td>
       <td>{x.label}</td>
       <td className={x.quantity > 0 ? 'positive' : 'negative'}>{x.quantity > 0 ? '+' : ''}{x.quantity}</td>
      </tr>)}
     </tbody>
    </table>
   </div>
  </div>
 </>;
}

export function CustomersPage({state, search}: {state: State; search: string}) {
 const exportCustomers = () => exportCSV([
  ['Nom', 'Téléphone', 'Gouvernorat', 'Adresse'],
  ...state.customers.map(c => [c.name, c.phone, c.city, c.address]),
 ], 'clients.csv');
 const needle = search.toLowerCase();
 return <div className="card">
  <div className="card-heading">
   <h2>{state.customers.length} clients</h2>
   <button className="button" onClick={exportCustomers}><Download size={15}/>Exporter</button>
  </div>
  <div className="table-scroll">
   <table>
    <thead><tr><th>Client</th><th>Téléphone</th><th>Gouvernorat</th><th>Commandes</th><th>Livrées</th><th>Score local</th><th>CA livré</th></tr></thead>
    <tbody>
     {state.customers.filter(c => (c.name + c.phone).toLowerCase().includes(needle)).map(c => {
      const orders = state.orders.filter(o => o.customerId === c.id);
      const delivered = orders.filter(o => o.status === 'DELIVERED');
      return <tr key={c.id}>
       <td><strong>{c.name}</strong><small>{c.address}</small></td>
       <td><a href={'tel:+216' + c.phone}>{c.phone}</a></td>
       <td>{c.city}</td>
       <td>{orders.length}</td>
       <td>{delivered.length}</td>
       <td><span className="badge neutral">{customerTrust(state, c.id).score}/100</span></td>
       <td>{money(delivered.reduce((n, o) => n + o.total, 0))} TND</td>
      </tr>;
     })}
    </tbody>
   </table>
  </div>
 </div>;
}
