import {money, type Order, type State} from '../commerce/types';

/**
 * Commerce Copilot without AI: plain rules over the shop's own data. Every insight states a fact,
 * counted from real orders and products, and points to the page where the merchant can act.
 */
export type Severity = 'urgent' | 'attention' | 'opportunity' | 'info';
export type Insight = {id: string; severity: Severity; title: string; detail: string; action?: {label: string; page: string}};

const HOUR = 3600000, DAY = 24 * HOUR;
const rank: Record<Severity, number> = {urgent: 0, attention: 1, opportunity: 2, info: 3};
/** Below this many finished shipments a refusal rate says nothing reliable. */
export const MIN_SHIPMENTS = 5;
export const HIGH_REFUSAL_RATE = .3;
const plural = (n: number, one: string, many: string) => n + ' ' + (n > 1 ? many : one);
const age = (iso: string | undefined, now: Date) => iso ? now.getTime() - Date.parse(iso) : 0;
const percent = (n: number) => Math.round(n * 100) + ' %';
const names = (items: {name: string}[], max = 4) => items.slice(0, max).map(i => i.name).join(', ') + (items.length > max ? '…' : '');

export function copilotInsights(state: State, now = new Date()): Insight[] {
 if (!state.products.length && !state.orders.length) return [{
  id: 'start', severity: 'info', title: 'Ajoutez vos premiers produits',
  detail: 'Les conseils apparaîtront dès vos premières commandes : confirmations en attente, stock, encaissements, taux de refus.',
  action: {label: 'Ajouter un produit', page: 'Produits'},
 }];
 const out: Insight[] = [];
 const orders = state.orders;

 const requests = orders.filter(o => o.customerRequests?.some(r => r.status === 'PENDING'));
 if (requests.length) out.push({id: 'requests', severity: 'urgent',
  title: plural(requests.length, 'demande client attend', 'demandes clients attendent') + ' votre réponse',
  detail: 'Annulation ou retour demandé depuis le lien de suivi : ' + requests.slice(0, 4).map(o => o.reference).join(', ') + '.',
  action: {label: 'Voir les commandes', page: 'Commandes'}});

 const waiting = orders.filter(o => o.status === 'TO_CONFIRM' && age(o.updatedAt || o.createdAt, now) > DAY);
 if (waiting.length) out.push({id: 'confirm-late', severity: 'urgent',
  title: plural(waiting.length, 'commande attend', 'commandes attendent') + ' votre confirmation depuis plus de 24 h',
  detail: 'Plus l’appel tarde, plus le client risque de refuser le colis. Plus ancienne : ' + [...waiting].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0].reference + '.',
  action: {label: 'Ouvrir le Call Center', page: 'Call Center'}});

 const callbacks = orders.filter(o => o.status === 'CALLBACK' && o.callbackAt && Date.parse(o.callbackAt) < now.getTime());
 if (callbacks.length) out.push({id: 'callback-late', severity: 'urgent',
  title: plural(callbacks.length, 'rappel', 'rappels') + ' en retard',
  detail: 'L’heure de rappel convenue avec le client est passée : ' + callbacks.slice(0, 4).map(o => o.reference).join(', ') + '.',
  action: {label: 'Ouvrir le Call Center', page: 'Call Center'}});

 const low = state.products.filter(p => p.active && p.stock <= p.threshold).sort((a, b) => a.stock - b.stock);
 if (low.length) {
  const out0 = low.filter(p => p.stock === 0).length;
  out.push({id: 'stock-low', severity: 'attention',
   title: plural(low.length, 'produit', 'produits') + ' en stock faible' + (out0 ? ' dont ' + out0 + ' épuisé' + (out0 > 1 ? 's' : '') : ''),
   detail: 'À réapprovisionner : ' + names(low) + '.', action: {label: 'Voir l’inventaire', page: 'Inventaire'}});
 }

 const unpaid = orders.filter(o => o.status === 'DELIVERED' && o.collected < o.total && age(o.updatedAt, now) > 7 * DAY);
 if (unpaid.length) out.push({id: 'cod-late', severity: 'attention',
  title: money(unpaid.reduce((n, o) => n + o.total - o.collected, 0)) + ' TND de COD non reçus pour ' + plural(unpaid.length, 'commande livrée', 'commandes livrées') + ' il y a plus de 7 jours',
  detail: 'Rapprochez ces encaissements avec votre transporteur : ' + unpaid.slice(0, 4).map(o => o.reference).join(', ') + '.',
  action: {label: 'Ouvrir Finances & COD', page: 'Finances & COD'}});

 const stuck = orders.filter(o => o.status === 'SHIPPED' && age(o.updatedAt, now) > 7 * DAY);
 if (stuck.length) out.push({id: 'shipped-late', severity: 'attention',
  title: plural(stuck.length, 'colis', 'colis') + ' en route depuis plus de 7 jours',
  detail: 'Vérifiez auprès du transporteur : ' + stuck.slice(0, 4).map(o => o.reference + (o.carrier ? ' (' + o.carrier + ')' : '')).join(', ') + '.',
  action: {label: 'Voir les livraisons', page: 'Livraisons'}});

 // Refusals over the last 90 days: only finished shipments count (delivered or refused).
 const finished = orders.filter(o => (o.status === 'DELIVERED' || o.status === 'RETURNED') && age(o.createdAt, now) <= 90 * DAY);
 const city = (o: Order) => (o.customerSnapshot || state.customers.find(c => c.id === o.customerId))?.city || '';
 const worst = (key: (o: Order) => string) => {
  const groups = new Map<string, {done: number; refused: number}>();
  for (const o of finished) {
   const k = key(o); if (!k) continue;
   const g = groups.get(k) || {done: 0, refused: 0};
   g.done++; if (o.status === 'RETURNED') g.refused++;
   groups.set(k, g);
  }
  return [...groups].filter(([, g]) => g.done >= MIN_SHIPMENTS && g.refused / g.done >= HIGH_REFUSAL_RATE)
   .sort((a, b) => b[1].refused / b[1].done - a[1].refused / a[1].done)[0];
 };
 const badCity = worst(city);
 if (badCity) out.push({id: 'refusals-city', severity: 'attention',
  title: 'Taux de refus élevé à ' + badCity[0] + ' : ' + percent(badCity[1].refused / badCity[1].done),
  detail: badCity[1].refused + ' colis refusés sur ' + badCity[1].done + ' expédiés en 90 jours. Confirmez ces commandes par appel avant l’envoi.',
  action: {label: 'Voir les analyses', page: 'Analyses'}});
 const badCarrier = worst(o => o.carrier || '');
 if (badCarrier) out.push({id: 'refusals-carrier', severity: 'attention',
  title: 'Taux de refus élevé avec ' + badCarrier[0] + ' : ' + percent(badCarrier[1].refused / badCarrier[1].done),
  detail: badCarrier[1].refused + ' refus sur ' + badCarrier[1].done + ' livraisons terminées en 90 jours. Comparez avec vos autres transporteurs.',
  action: {label: 'Comparer les transporteurs', page: 'Transporteurs & zones'}});

 // Sales trend: orders created in the last 7 days against the 7 days before (cancellations excluded).
 const valued = orders.filter(o => o.status !== 'CANCELLED');
 const sum = (from: number, to: number) => valued.filter(o => {const a = age(o.createdAt, now); return a >= from && a < to;}).reduce((n, o) => n + o.total, 0);
 const recent = sum(0, 7 * DAY), before = sum(7 * DAY, 14 * DAY);
 if (recent && before) {
  const change = (recent - before) / before;
  out.push({id: 'trend', severity: change >= .1 ? 'opportunity' : 'info',
   title: 'Ventes des 7 derniers jours : ' + (change >= 0 ? '+' : '−') + percent(Math.abs(change)) + ' par rapport à la semaine précédente',
   detail: money(recent) + ' TND contre ' + money(before) + ' TND, commandes annulées exclues.',
   action: {label: 'Voir les analyses', page: 'Analyses'}});
 }

 const sold = new Map<string, number>();
 for (const o of orders) if (o.status === 'DELIVERED' && age(o.createdAt, now) <= 30 * DAY) for (const i of o.items) sold.set(i.productId, (sold.get(i.productId) || 0) + i.quantity);
 const star = [...sold].sort((a, b) => b[1] - a[1])[0];
 const starProduct = star && state.products.find(p => p.id === star[0]);
 if (starProduct && star[1] >= 3) out.push({id: 'star', severity: 'opportunity',
  title: 'Produit vedette : ' + starProduct.name + ' (' + plural(star[1], 'vente livrée', 'ventes livrées') + ' en 30 jours)',
  detail: starProduct.stock <= starProduct.threshold ? 'Son stock est faible : réapprovisionnez-le en priorité.' : 'Mettez-le en avant sur votre accueil et dans vos publicités.',
  action: {label: 'Voir le produit', page: 'Produits'}});

 const abandoned = state.carts.filter(c => c.status === 'ACTIVE' && c.items.length && age(c.updatedAt, now) > HOUR);
 if (abandoned.length) out.push({id: 'carts', severity: 'info',
  title: plural(abandoned.length, 'panier abandonné', 'paniers abandonnés'),
  detail: 'Des visiteurs ont ajouté des produits sans commander. Un prix clair de la livraison et une offre de quantité aident à conclure.',
  action: {label: 'Voir les paniers', page: 'Paniers'}});

 return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
