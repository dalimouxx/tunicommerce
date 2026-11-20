'use client';
import {useState} from 'react';
import {Download} from 'lucide-react';
import {money, type State} from '../../modules/commerce/types';
import {carrierManifestFilename, carrierManifestRows, manifestCarriers} from '../../modules/delivery/carrier-manifest';
import {dispatchManifestCsv, type DispatchStatus} from '../../modules/shops/dispatch-manifest';
import {Field, Modal} from '../forms';

/** Shipping manifest for the carrier: parcels ready or in transit, with COD amounts, as a spreadsheet-safe CSV. */
export function CarrierManifestDialog({state, close}: {state: State; close: () => void}) {
 const [status, setStatus] = useState<DispatchStatus>('READY');
 const [carrier, setCarrier] = useState('');
 const rows = carrierManifestRows(state, {status, carrier});
 const cod = rows.reduce((n, r) => n + r.codMillimes, 0);
 const download = () => {
  const url = URL.createObjectURL(new Blob([dispatchManifestCsv(rows)], {type: 'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = carrierManifestFilename(new Date(), carrier);
  a.click();
  URL.revokeObjectURL(url);
 };
 return <Modal title="Bordereau transporteur" close={close}>
  <p>La liste des colis à remettre au transporteur : client, téléphone, adresse, articles et montant à encaisser.</p>
  <div className="form-grid">
   <Field label="Colis">
    <select value={status} onChange={e => setStatus(e.target.value as DispatchStatus)}>
     <option value="READY">Prêts à expédier</option>
     <option value="SHIPPED">Expédiés, en cours de livraison</option>
     <option value="ALL">Les deux</option>
    </select>
   </Field>
   <Field label="Transporteur">
    <select value={carrier} onChange={e => setCarrier(e.target.value)}>
     <option value="">Tous les transporteurs</option>
     {manifestCarriers(state).map(name => <option key={name} value={name}>{name} · {carrierManifestRows(state, {status, carrier: name}).length} colis</option>)}
    </select>
   </Field>
  </div>
  <div className="form-total" aria-live="polite"><span>{rows.length} colis · COD à encaisser</span><strong>{money(cod)} TND</strong></div>
  <p className="muted small">Fichier CSV lisible par Excel ou Google Sheets. Il contient les coordonnées de vos clients : transmettez-le uniquement à votre transporteur.</p>
  <button className="primary full" disabled={!rows.length} onClick={download}><Download size={16}/>{rows.length ? 'Télécharger le bordereau' : 'Aucun colis pour ce choix'}</button>
 </Modal>;
}
