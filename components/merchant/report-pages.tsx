import {ChartNoAxesCombined, CheckCircle2, Clock, Plus, RotateCcw, ShoppingBag, Truck, Wallet} from 'lucide-react';
import {money, type Order, type Product, type State} from '../../modules/commerce/types';
import {ProductArt} from '../product-art';
import {Stat} from '../stat';
import {dt, orderCustomer, type Metrics} from './shared';

export function FinancesPage({state, m, periodOrders, onSelect, addExpense}: {
 state: State; m: Metrics; periodOrders: Order[]; onSelect: (id: string) => void; addExpense: () => void;
}) {
 const margin: [string, number][] = [
  ['CA livré brut', m.grossRevenue],
  ['Avoirs après retour', -m.credits],
  ['Coût des produits', -m.cogs],
  ['Livraisons et retours estimés', -m.delivery],
  ['Autres dépenses', -m.expenses],
 ];
 return <>
  <section className="stats-grid">
   <Stat title="CA livré net des avoirs" value={money(m.revenue)} suffix="TND" foot="Livraison incluse, avoirs déduits" icon={<Wallet size={18}/>} color="green"/>
   <Stat title="COD encaissé" value={money(m.collected)} suffix="TND" foot="Versements enregistrés" icon={<CheckCircle2 size={18}/>} color="blue"/>
   <Stat title="COD restant" value={money(m.pending)} suffix="TND" foot="À récupérer auprès des transporteurs" icon={<Clock size={18}/>} color="orange"/>
   <Stat title="Marge opérationnelle" value={money(m.profit)} suffix="TND" foot="Avant fiscalité · Coûts livraison estimés" icon={<ChartNoAxesCombined size={18}/>} color="purple"/>
  </section>
  <div className="dashboard-middle finance-grid">
   <div className="card">
    <div className="card-heading"><h2>Rapprochement COD</h2><span className="badge to_confirm">Versements manuels</span></div>
    <div className="table-scroll">
     <table>
      <thead><tr><th>Commande</th><th>Transporteur</th><th>Attendu</th><th>Reçu</th><th>Restant</th></tr></thead>
      <tbody>
       {periodOrders.filter(o => o.status === 'DELIVERED').map(o => <tr key={o.id} onClick={() => onSelect(o.id)}>
        <td><strong>{o.reference}</strong></td>
        <td>{o.carrier}</td>
        <td>{money(o.total)}</td>
        <td>{money(o.collected)}</td>
        <td className={o.collected < o.total ? 'negative' : 'positive'}>{money(o.total - o.collected)}</td>
       </tr>)}
      </tbody>
     </table>
    </div>
   </div>
   <div className="card profit-card">
    <div className="card-heading"><h2>Comprendre votre marge</h2></div>
    {margin.map(([label, value]) => <div className="finance-line" key={label}><span>{label}</span><strong>{money(value)}</strong></div>)}
    <div className="finance-line total"><span>Marge opérationnelle</span><strong>{money(m.profit)} TND</strong></div>
    <p className="muted small pad">Les tarifs configurés à l’expédition sont figés sur la commande. Les anciennes saisies manuelles conservent l’estimation de 7 DT livré / 14 DT refus tant qu’elle n’est pas corrigée.</p>
    <button className="button" onClick={addExpense}><Plus size={16}/>Ajouter une dépense</button>
   </div>
  </div>
  <div className="info-strip">Avoirs après livraison : {money(m.credits)} TND · Remboursements enregistrés : {money(m.refunds)} TND · Reste à rembourser : {money(m.refundDue)} TND</div>
  <div className="card">
   <div className="card-heading"><h2>Dépenses enregistrées</h2><button className="text-button" onClick={addExpense}><Plus size={15}/>Ajouter</button></div>
   <table>
    <thead><tr><th>Libellé</th><th>Catégorie</th><th>Date</th><th>Montant</th></tr></thead>
    <tbody>
     {state.expenses.map(e => <tr key={e.id}><td>{e.label}</td><td>{e.category}</td><td>{dt(e.date)}</td><td>{money(e.amount)} TND</td></tr>)}
    </tbody>
   </table>
  </div>
 </>;
}

export function AnalyticsPage({state, m, periodOrders, topProducts}: {
 state: State; m: Metrics; periodOrders: Order[]; topProducts: (Product & {units: number})[];
}) {
 const finished = m.delivered + m.returned;
 return <>
  <div className="stats-grid three">
   <Stat title="Panier moyen livré" value={money(m.delivered ? Math.round(m.revenue / m.delivered) : 0)} suffix="TND" foot="Sur la période sélectionnée" icon={<ShoppingBag size={18}/>} color="green"/>
   <Stat title="Taux de retour" value={`${finished ? Math.round(m.returned / finished * 100) : 0}%`} foot="Sur les expéditions terminées" icon={<RotateCcw size={18}/>} color="orange"/>
   <Stat title="Commandes livrées" value={String(m.delivered)} foot={`${periodOrders.length} commandes créées sur la période`} icon={<Truck size={18}/>} color="blue"/>
  </div>
  <div className="bottom-grid">
   <div className="card">
    <div className="card-heading"><h2>Ventes par gouvernorat</h2></div>
    {[...new Set(state.customers.map(c => c.city))].map(city => {
     const orders = periodOrders.filter(o => orderCustomer(state, o)?.city === city);
     const revenue = orders.filter(o => o.status === 'DELIVERED').reduce((n, o) => n + o.total, 0);
     return <div className="geo-row" key={city}>
      <div><strong>{city}</strong><span>{money(revenue)} TND</span></div>
      <div className="progress"><i style={{width: `${m.revenue ? revenue / m.revenue * 100 : 0}%`}}/></div>
      <small>{orders.length} commandes</small>
     </div>;
    })}
   </div>
   <div className="card">
    <div className="card-heading"><h2>Performance des produits</h2></div>
    {topProducts.map((p, i) => <div className="top-product" key={p.id}>
     <span className="rank">{i + 1}</span>
     <ProductArt category={p.category} color={p.color}/>
     <div><strong>{p.name}</strong><small>{p.variant}</small></div>
     <strong>{p.units} ventes</strong>
    </div>)}
   </div>
  </div>
 </>;
}
