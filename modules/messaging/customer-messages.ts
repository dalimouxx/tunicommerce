import {z} from 'zod';
import {money, type Order, type State, type Status} from '../commerce/types';
import {normalizeTunisianPhone} from '../shops/product-cod-form';

/**
 * Customer messages prepared by the merchant's own WhatsApp (click-to-chat): no provider account,
 * nothing is sent without the merchant's click. Rules say which message to propose at each order status.
 */
export const messageRules = [
 {key: 'TO_CONFIRM', status: 'TO_CONFIRM', label: 'Commande reçue', hint: 'Demander au client de confirmer sa commande.',
  text: 'Bonjour {client}, merci pour votre commande {reference} chez {boutique} ({articles}) : {total} TND, paiement à la livraison. Pouvez-vous nous la confirmer par retour de message ?'},
 {key: 'CONFIRMED', status: 'CONFIRMED', label: 'Commande confirmée', hint: 'Remercier et annoncer la préparation.',
  text: 'Bonjour {client}, votre commande {reference} est confirmée. Nous la préparons et vous prévenons dès son expédition. Merci de votre confiance ! {boutique}'},
 {key: 'SHIPPED', status: 'SHIPPED', label: 'Commande expédiée', hint: 'Donner le transporteur et le numéro de colis.',
  text: 'Bonjour {client}, votre commande {reference} est en route avec {transporteur} (colis {colis}). Montant à régler à la livraison : {total} TND. Suivi : {suivi}'},
 {key: 'DELIVERED', status: 'DELIVERED', label: 'Commande livrée', hint: 'Remercier après la livraison.',
  text: 'Bonjour {client}, votre commande {reference} a été livrée. Merci pour votre achat chez {boutique} ! Une question ? Répondez simplement à ce message.'},
] as const;
export type MessageRuleKey = typeof messageRules[number]['key'];
export const MESSAGE_VARIABLES = ['{client}', '{reference}', '{total}', '{articles}', '{transporteur}', '{colis}', '{suivi}', '{boutique}'] as const;
export const messageVariableLabels: Record<typeof MESSAGE_VARIABLES[number], string> = {
 '{client}': 'prénom du client', '{reference}': 'référence', '{total}': 'montant total', '{articles}': 'articles',
 '{transporteur}': 'transporteur', '{colis}': 'numéro de colis', '{suivi}': 'lien de suivi', '{boutique}': 'nom de la boutique',
};

const rule = z.object({enabled: z.boolean(), text: z.string().trim().min(1, 'Message vide').max(1000, 'Message trop long : 1000 caractères maximum')}).strict();
export const messagingSettings = z.object({
 rules: z.object(Object.fromEntries(messageRules.map(r => [r.key, rule])) as Record<MessageRuleKey, typeof rule>).strict(),
}).strict();
export type MessagingSettings = z.infer<typeof messagingSettings>;
export const logMessagePayload = z.object({
 id: z.string().min(1).max(160),
 rule: z.enum(messageRules.map(r => r.key) as [MessageRuleKey, ...MessageRuleKey[]]),
 channel: z.enum(['WHATSAPP']),
}).strict();

/** Saved settings, completed with the defaults for any rule never configured. */
export function readMessaging(state: State): MessagingSettings {
 const saved: Partial<MessagingSettings['rules']> = state.shop.messaging?.rules || {};
 return {rules: Object.fromEntries(messageRules.map(r => [r.key, saved[r.key] || {enabled: true, text: r.text}])) as MessagingSettings['rules']};
}

export function ruleForStatus(state: State, status: Status) {
 const definition = messageRules.find(r => r.status === status);
 if (!definition) return null;
 const settings = readMessaging(state).rules[definition.key];
 return settings.enabled ? {...definition, text: settings.text} : null;
}

export function orderPhone(state: State, order: Order) {
 return (order.customerSnapshot || state.customers.find(c => c.id === order.customerId))?.phone || '';
}

/** Fills the variables from the order; a missing value (no parcel yet…) leaves no placeholder behind. */
export function renderMessage(template: string, state: State, order: Order, origin: string) {
 const customer = order.customerSnapshot || state.customers.find(c => c.id === order.customerId);
 const values: Record<string, string> = {
  '{client}': customer?.name.trim().split(/\s+/)[0] || '',
  '{reference}': order.reference,
  '{total}': money(order.total),
  '{articles}': order.items.map(i => i.quantity + ' × ' + i.name).join(', '),
  '{transporteur}': order.carrier || '',
  '{colis}': order.tracking || '',
  '{suivi}': order.publicReceiptId ? origin.replace(/\/$/, '') + '/suivi/' + order.publicReceiptId : '',
  '{boutique}': state.shop.name,
 };
 const filled = template.replace(/\{[a-z_]+\}/g, token => token in values ? values[token] : token);
 // Labels whose value is still unknown (no parcel number or tracking link yet) are dropped.
 return filled
  .replace(/\s*\((?:colis|n°)\s*\)/gi, '')
  .replace(/\s*(?:Suivi|Colis)\s*:\s*(?=$|\n)/g, '')
  .replace(/ (?:avec|par)(?=[.,])/g, '')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/ +([.,])/g, '$1')
  .trim();
}

export function whatsappMessageUrl(phone: string, text: string) {
 const number = normalizeTunisianPhone(phone);
 if (!/^[2459][0-9]{7}$/.test(number)) return '';
 return 'https://wa.me/216' + number + '?text=' + encodeURIComponent(text);
}

export const ruleLabel = (key: MessageRuleKey) => messageRules.find(r => r.key === key)!.label;
