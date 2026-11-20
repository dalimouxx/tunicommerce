import type {State} from '../commerce/types';
import {dispatchManifestPage, type DispatchRow, type DispatchStatus} from '../shops/dispatch-manifest';

/** Parcels to hand over to a carrier (all pages of the existing manifest), optionally for one carrier. */
export function carrierManifestRows(state: State, filter: {status: DispatchStatus; carrier: string}): DispatchRow[] {
 const first = dispatchManifestPage(state, {status: filter.status, page: 1});
 const rows = [...first.rows];
 for (let page = 2; page <= first.totalPages; page++) rows.push(...dispatchManifestPage(state, {status: filter.status, page}).rows);
 return filter.carrier ? rows.filter(row => row.carrier === filter.carrier) : rows;
}

/** Carriers that have parcels to prepare or in transit, plus the configured ones. */
export function manifestCarriers(state: State) {
 const names = new Set([
  ...state.orders.filter(o => (o.status === 'READY' || o.status === 'SHIPPED') && o.carrier).map(o => o.carrier),
  ...state.carriers.filter(c => c.active).map(c => c.name),
 ]);
 return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
}

export function carrierManifestFilename(date: Date, carrier: string) {
 const slug = carrier.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
 return 'bordereau-' + date.toISOString().slice(0, 10) + (slug ? '-' + slug : '') + '.csv';
}
