'use client';
import {useState} from 'react';
import {Plus, Truck, MapPin, Settings} from 'lucide-react';
import {State, Carrier, DeliveryZone, Order, governors, money} from '../modules/commerce/types';
import {compareCarriers} from '../modules/delivery/pricing';
import {Modal, Field} from './forms';

type Props = {state: State; act: (action: string, payload: unknown) => Promise<boolean>; busy: boolean};
const tabs = [['zones', 'Zones & tarifs'], ['carriers', 'Transporteurs'], ['compare', 'Comparer']];
const toMillimes = (value: unknown) => Math.round(Number(value) * 1000);

/** Delivery zones billed to customers, carriers' agreed costs, and a per-destination comparison. */
export function DeliverySettings({state, act, busy}: Props) {
 const [tab, setTab] = useState('zones');
 const [mode, setMode] = useState('');
 const [zone, setZone] = useState<DeliveryZone>();
 const [carrier, setCarrier] = useState<Carrier>();
 const [city, setCity] = useState('Gabès');
 const addRecord = () => {
  if (tab === 'zones') { setZone(undefined); setMode('zone'); }
  else { setCarrier(undefined); setMode('carrier'); }
 };
 const title = mode === 'zone' ? (zone ? 'Modifier la zone' : 'Nouvelle zone') : (carrier ? 'Modifier le transporteur' : 'Nouveau transporteur');
 return <>
  <div className="list-toolbar card delivery-tabs">
   <div className="tabs">
    {tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
   </div>
   <button className="primary" onClick={addRecord}><Plus size={16}/>{tab === 'zones' ? 'Ajouter une zone' : 'Ajouter un transporteur'}</button>
  </div>
  {tab === 'zones' && <ZonesTab state={state} edit={z => { setZone(z); setMode('zone'); }}/>}
  {tab === 'carriers' && <CarriersTab state={state} edit={c => { setCarrier(c); setMode('carrier'); }}/>}
  {tab === 'compare' && <CompareTab state={state} city={city} setCity={setCity}/>}
  {mode && <Modal title={title} close={() => setMode('')}>
   <DeliveryForm kind={mode} zone={zone} carrier={carrier} busy={busy}
    submit={p => act(mode === 'zone' ? 'saveZone' : 'saveCarrier', p).then(ok => { if (ok) setMode(''); })}/>
  </Modal>}
 </>;
}

function ZonesTab({state, edit}: {state: State; edit: (zone: DeliveryZone) => void}) {
 return <>
  <div className="info-strip"><MapPin size={17}/>Le tarif de la zone s’applique aux nouvelles commandes. Le seuil de gratuité est calculé après remise. Les régions sans zone active utilisent le tarif par défaut : {money(state.shop.shipping)} TND.</div>
  <div className="delivery-zone-grid">
   {state.zones.map(z => <div className="card zone-card" key={z.id}>
    <div className="card-heading"><h2>{z.name}</h2><span className={'badge ' + (z.active ? 'delivered' : 'neutral')}>{z.active ? 'Active' : 'Inactive'}</span></div>
    <p>{z.governorates.join(' · ')}</p>
    <div className="zone-price"><strong>{money(z.fee)} <small>TND</small></strong><span>{z.estimatedDays} jour(s) estimés</span></div>
    <div className="zone-free">{z.freeAbove === null ? 'Sans seuil de gratuité' : 'Offerte dès ' + money(z.freeAbove) + ' TND après remise'}</div>
    <button className="button" onClick={() => edit(z)}><Settings size={14}/>Modifier</button>
   </div>)}
  </div>
  {!state.zones.length && <div className="card empty">
   <MapPin/>
   <h3>Un tarif adapté à chaque région</h3>
   <p>Ajoutez votre première zone. Vos anciennes commandes conservent leur tarif.</p>
  </div>}
 </>;
}

function CarriersTab({state, edit}: {state: State; edit: (carrier: Carrier) => void}) {
 return <>
  <div className="info-strip"><Truck size={17}/>Gestion manuelle des transporteurs. Aucune API externe n’est connectée ; les numéros de suivi et versements sont saisis dans l’application.</div>
  <div className="card">
   <div className="table-scroll">
    <table>
     <thead><tr><th>Transporteur</th><th>Couverture</th><th>Coût livré</th><th>Coût total refus</th><th>État</th><th></th></tr></thead>
     <tbody>
      {state.carriers.map(c => <tr key={c.id}>
       <td><strong>{c.name}</strong><small>{c.phone || 'Téléphone non renseigné'}</small></td>
       <td>{c.governorates.length} gouvernorats</td>
       <td>{money(c.deliveryCost)} DT</td>
       <td>{money(c.returnCost)} DT</td>
       <td><span className={'badge ' + (c.active ? 'delivered' : 'neutral')}>{c.active ? 'Actif' : 'Inactif'}</span></td>
       <td><button className="button small-button" onClick={() => edit(c)}>Modifier</button></td>
      </tr>)}
     </tbody>
    </table>
    {!state.carriers.length && <div className="empty">
     <Truck/>
     <h3>Aucun transporteur configuré</h3>
     <p>Ajoutez les tarifs convenus avec vos partenaires.</p>
    </div>}
   </div>
  </div>
 </>;
}

function CompareTab({state, city, setCity}: {state: State; city: string; setCity: (city: string) => void}) {
 const comparisons = compareCarriers(state, city);
 return <>
  <div className="card settings-card">
   <Field label="Destination"><select value={city} onChange={e => setCity(e.target.value)}>{governors.map(g => <option key={g}>{g}</option>)}</select></Field>
   <p className="muted small">Tri par coût de livraison configuré. Le taux de livraison provient uniquement des commandes terminées de cette boutique ; un petit échantillon ne suffit pas à prédire la performance.</p>
  </div>
  <div className="card spaced">
   <table>
    <thead><tr><th>Transporteur</th><th>Coût livré</th><th>Refus / retour</th><th>Historique local</th></tr></thead>
    <tbody>
     {comparisons.map((c, i) => <tr key={c.id}>
      <td><strong>{c.name}</strong>{i === 0 && <small>Tarif configuré le plus bas</small>}</td>
      <td>{money(c.deliveryCost)} DT</td>
      <td>{money(c.returnCost)} DT</td>
      <td>{c.deliveryRate === null ? 'Pas d’historique' : c.deliveryRate + ' % livrées'}<small>{c.completed} expédition(s) terminée(s)</small></td>
     </tr>)}
    </tbody>
   </table>
   {!comparisons.length && <div className="empty"><p>Aucun transporteur actif ne couvre cette destination.</p></div>}
  </div>
 </>;
}

/** Zone or carrier form: amounts typed in TND are sent in millimes; an empty free threshold means never free. */
function DeliveryForm({kind, zone, carrier, busy, submit}: {
 kind: string; zone?: DeliveryZone; carrier?: Carrier; busy: boolean; submit: (p: unknown) => void;
}) {
 const record = kind === 'zone' ? zone : carrier;
 const [regions, setRegions] = useState(record?.governorates || []);
 const allSelected = regions.length === 24;
 return <form onSubmit={e => {
  e.preventDefault();
  const fields: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget));
  for (const key of ['fee', 'deliveryCost', 'returnCost']) if (key in fields) fields[key] = toMillimes(fields[key]);
  if (kind === 'zone') {
   fields.freeAbove = fields.freeAbove === '' ? null : toMillimes(fields.freeAbove);
   fields.estimatedDays = Number(fields.estimatedDays);
  }
  submit({...fields, id: record?.id, active: fields.active === 'on', governorates: regions});
 }}>
  <Field label="Nom"><input name="name" defaultValue={record?.name} required maxLength={120}/></Field>
  {kind === 'zone'
   ? <div className="form-grid">
    <Field label="Livraison facturée au client (TND)"><input type="number" min="0" step=".001" name="fee" defaultValue={(zone?.fee ?? 8000) / 1000} required/></Field>
    <Field label="Gratuite dès (TND, vide = jamais)">
     <input type="number" min="0" step=".001" name="freeAbove" defaultValue={zone?.freeAbove === null || zone?.freeAbove === undefined ? '' : zone.freeAbove / 1000}/>
    </Field>
    <Field label="Délai estimé (jours)"><input type="number" name="estimatedDays" min="1" max="60" defaultValue={zone?.estimatedDays || 2} required/></Field>
   </div>
   : <>
    <Field label="Téléphone du partenaire"><input name="phone" defaultValue={carrier?.phone}/></Field>
    <div className="form-grid">
     <Field label="Coût d’une livraison réussie (TND)"><input type="number" min="0" step=".001" name="deliveryCost" defaultValue={(carrier?.deliveryCost ?? 7000) / 1000} required/></Field>
     <Field label="Coût total d’un refus (aller + retour, TND)"><input type="number" min="0" step=".001" name="returnCost" defaultValue={(carrier?.returnCost ?? 14000) / 1000} required/></Field>
    </div>
   </>}
  <div className="region-heading">
   <strong>Gouvernorats couverts</strong>
   <button type="button" className="text-button" onClick={() => setRegions(allSelected ? [] : [...governors])}>{allSelected ? 'Tout désélectionner' : 'Toute la Tunisie'}</button>
  </div>
  <div className="region-grid">
   {governors.map(g => <label key={g}>
    <input type="checkbox" checked={regions.includes(g)} onChange={e => setRegions(e.target.checked ? [...regions, g] : regions.filter(x => x !== g))}/>{g}
   </label>)}
  </div>
  <label className="check-label"><input type="checkbox" name="active" defaultChecked={record?.active ?? true}/>Activer pour les prochaines commandes</label>
  <button className="primary full" disabled={busy || regions.length === 0}>Enregistrer</button>
 </form>;
}

/** Carrier choice when marking an order shipped; configured carriers freeze their costs on the order. */
export function ShipmentFields({state, order}: {state: State; order: Order}) {
 const city = (order.customerSnapshot || state.customers.find(c => c.id === order.customerId))?.city || '';
 const choices = compareCarriers(state, city);
 const [carrierId, setCarrierId] = useState(choices[0]?.id || '');
 const carrier = choices.find(c => c.id === carrierId);
 return <>
  <Field label={'Transporteur pour ' + city}>
   <select name="carrierId" value={carrierId} onChange={e => setCarrierId(e.target.value)}>
    <option value="">Saisie manuelle (non configuré)</option>
    {choices.map(c => <option key={c.id} value={c.id}>{c.name} · {money(c.deliveryCost)} DT</option>)}
   </select>
  </Field>
  {!carrierId && <Field label="Nom du transporteur"><input name="carrier" required/></Field>}
  {carrier && <div className="info-strip">Tarifs enregistrés : livré {money(carrier.deliveryCost)} DT · Refus total {money(carrier.returnCost)} DT. Ces coûts seront figés sur la commande.</div>}
  <Field label="Numéro de suivi attribué par le transporteur"><input name="tracking" required maxLength={160}/></Field>
  <p className="muted small">L’expédition est enregistrée manuellement. Aucune demande n’est envoyée au transporteur.</p>
 </>;
}

/** Corrects an order's carrier costs from a receipt; the customer price and COD stay unchanged. */
export function ShipmentCostForm({order, submit, busy}: {order: Order; submit: (p: unknown) => void; busy: boolean}) {
 return <form onSubmit={e => {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  submit({id: order.id, deliveryCost: toMillimes(f.get('deliveryCost')), returnCost: toMillimes(f.get('returnCost')), reason: f.get('reason')});
 }}>
  <p>Corriger les frais de {order.reference} à partir d’un justificatif. Le montant facturé au client et le COD ne changent pas.</p>
  <Field label="Coût livré (TND)"><input type="number" name="deliveryCost" min="0" step=".001" defaultValue={order.deliveryCost / 1000} required/></Field>
  <Field label="Coût total refus / retour (TND)"><input type="number" name="returnCost" min="0" step=".001" defaultValue={(order.returnDeliveryCost ?? order.deliveryCost * 2) / 1000} required/></Field>
  <Field label="Motif et référence du justificatif"><input name="reason" minLength={3} required/></Field>
  <button className="primary full" disabled={busy}>Enregistrer la correction</button>
 </form>;
}
